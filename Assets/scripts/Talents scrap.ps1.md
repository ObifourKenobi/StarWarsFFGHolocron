$BaseUrl = "https://star-wars-rpg-ffg.fandom.com"
$OutputDir = "./"

if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Path $OutputDir | Out-Null }

# --- Helper Function (Defined once to prevent recursion/memory issues) ---
function Get-CleanText ($RawHtml) {
    if ($null -eq $RawHtml) { return "N/A" }
    # 1. Strip HTML tags
    $text = $RawHtml -replace '<[^>]*>', ''
    # 2. Decode HTML Entities (&#91; -> [)
    $text = [System.Net.WebUtility]::HtmlDecode($text)
    # 3. Remove Citation Brackets [1][2][etc]
    $text = $text -replace '\[\d+\]', ''
    # 4. Remove empty brackets []
    $text = $text -replace '\[\]', ''
    return $text.Trim()
}

# --- 1. Get the Talent List ---
$CatUrl = "$BaseUrl/api.php?action=parse&page=Category:Talents&format=json&disabletoc=true"
Write-Host "Fetching talent list." -ForegroundColor Cyan

try {
    $CatResponse = Invoke-RestMethod -Uri $CatUrl -Method Get
    $CatHtml = $CatResponse.parse.text.'*'
    $TalentLinks = [regex]::Matches($CatHtml, 'href="/wiki/([^"]+)"') | 
                   ForEach-Object { $_.Groups[1].Value } | 
                   Select-Object -Unique | 
                   Where-Object { 
                       $_ -and ($_ -notmatch "Category:|Template:|File:|Special:|Help:|Action=edit") 
                   }

    Write-Host "Found $($TalentLinks.Count) entries. Processing." -ForegroundColor Green

    # --- 2. Process each page ---
    foreach ($PageName in $TalentLinks) {
        
        if ([string]::IsNullOrWhiteSpace($PageName)) {
            Write-Host "[ERROR] Found an empty page link entry!" -ForegroundColor Red
            continue
        }

        # FIX: Use UnescapeDataString first to handle already encoded characters, 
        # then build the URL using a method that handles apostrophes correctly.
        $RawName = [uri]::UnescapeDataString($PageName)
        $PageUrl = "${BaseUrl}/api.php?action=parse&page=$([uri]::EscapeUriString($RawName))&format=json&disabletoc=true"
        
        try {
            # Use -UseBasicParsing to ensure the engine handles the raw stream simply
            $Response = Invoke-RestMethod -Uri $PageUrl -Method Get
            
            if ($null -eq $Response.parse) {
                Write-Host "[ERROR] Wiki returned no data for: $RawName" -ForegroundColor Red
                continue
            }

            $CleanTitle = $Response.parse.title
            Write-Host "Processing: $CleanTitle" -ForegroundColor Yellow
            $Html = $Response.parse.text.'*'

            # A. Extract Activation & Ranked
            $Activation = if ($Html -match '<li><b>Activation:</b>\s*(.*?)</li>') { Get-CleanText $Matches[1] } else { "N/A" }
            $Ranked     = if ($Html -match '<li><b>Ranked:</b>\s*(.*?)</li>') { Get-CleanText $Matches[1] } else { "N/A" }

            # B. Extract the BODY
            $BodyText = ""
            if ($Html -match '(?s)</ul>(.*?)<div class="mw-references-wrap">') {
                $RawBody = $Matches[1]
                $BodyText = $RawBody -replace '<p>', "`n`n" -replace '</p>', ""
                $BodyText = Get-CleanText $BodyText
            }

            # C. Extract Source
            $Source = "No source listed"
            if ($Html -match '<span class="reference-text">(.*?)</span>') {
                $RawSource = $Matches[1]
                $BookName = ""
                if ($RawSource -match '<a [^>]*>(.*?)</a>') {
                    $BookName = Get-CleanText $Matches[1]
                }
                $PageNum = ""
                if ($RawSource -match '\(Page\s*(\d+)\)') {
                    $PageNum = ":" + $Matches[1]
                }
                if ($BookName) {
                    $Source = "[[$BookName|$BookName$PageNum]]"
                } else {
                    $Source = Get-CleanText $RawSource
                }
            }

            # --- 3. Assemble Markdown ---
            $MdContent = @"
---
activation: $Activation
ranked: $Ranked
---

$BodyText

# Sources
$Source
"@

            # --- 4. Filename Cleaning ---
            $FileName = $CleanTitle -replace '(?i)[\s_]talent$', '' 
            $FileName = $FileName -replace '[:\\/?"<>|*]', '_'
            
            $FilePath = Join-Path $OutputDir "$FileName.md"
            $MdContent | Out-File -FilePath $FilePath -Encoding utf8
            
            Start-Sleep -Milliseconds 50
        }
        catch {
            Write-Host "[ERROR] Failed at: $RawName" -ForegroundColor Red
            Write-Host "Exception: $($_.Exception.Message)" -ForegroundColor Gray
        }
    }
}
catch {
    Write-Host "[CRITICAL ERROR] Could not reach the Category page." -ForegroundColor Red
}

Write-Host "Backup Complete! Files are in $OutputDir" -ForegroundColor Green