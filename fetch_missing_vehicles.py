import json
import re
import os
from urllib.parse import quote

def fetch_vehicle(name):
    import urllib.request
    url = f"https://star-wars-rpg-ffg.fandom.com/api.php?action=parse&page={quote(name)}&format=json"
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"Error fetching {name}: {e}")
        return None

def parse_vehicle_html(html):
    data = {}
    
    # Extract silhouette, speed, handling from image alt text
    # Example: "Silhouette 4 Speed 5 Handling +1 Defense (Fore/Port/Starboard/Aft) 2/-/-/2 Armor 5 Hull Trauma Threshold 30 System Strain Threshold 15"
    alt_pattern = r'Silhouette (\d+) Speed (\d+) Handling ([+-]?\d+)'
    alt_match = re.search(alt_pattern, html)
    if alt_match:
        data['silhouette'] = int(alt_match.group(1))
        data['speed'] = int(alt_match.group(2))
        data['handling'] = alt_match.group(3)
    
    # Defense (Fore/Port/Starboard/Aft)
    def_pattern = r'Defense \(Fore/Port/Starboard/Aft\) (\d+)/(\d+)/(\d+)/(\d+)'
    def_match = re.search(def_pattern, html)
    if def_match:
        data['defense_fore'] = int(def_match.group(1))
        data['defense_port'] = int(def_match.group(2))
        data['defense_starboard'] = int(def_match.group(3))
        data['defense_aft'] = int(def_match.group(4))
    
    # Armor
    armor_pattern = r'Armor (\d+)'
    armor_match = re.search(armor_pattern, html)
    if armor_match:
        data['armor'] = int(armor_match.group(1))
    
    # Hull Trauma Threshold
    ht_pattern = r'Hull Trauma Threshold (\d+)'
    ht_match = re.search(ht_pattern, html)
    if ht_match:
        data['hull_trauma_threshold'] = int(ht_match.group(1))
    
    # System Strain Threshold
    ss_pattern = r'System Strain Threshold (\d+)'
    ss_match = re.search(ss_pattern, html)
    if ss_match:
        data['system_strain_threshold'] = int(ss_match.group(1))
    
    # Extract fields from text
    fields = {
        'Hull Type/Class': 'vehicle_type',
        'Manufacturer': 'manufacturer',
        'Sensor Range': 'sensor_range',
        "Ship's Complement": 'crew',
        'Encumbrance Capacity': 'encumbrance_capacity',
        'Passenger Capacity': 'passenger_capacity',
        'Price/Rarity': 'price_rarity',
        'Customization Hard Points': 'customization_hard_points',
    }
    
    for field, key in fields.items():
        pattern = rf'{field}:\s*([^<]+?)(?:\.|<br />|$)'
        match = re.search(pattern, html)
        if match:
            data[key] = match.group(1).strip()
    
    # Hyperdrive
    hyper_pattern = r'<b>Hyperdrive:</b>\s*([^<]+?)(?:\.|<br />|$)'
    hyper_match = re.search(hyper_pattern, html)
    if hyper_match:
        data['hyperdrive'] = hyper_match.group(1).strip()
    
    # Navicomputer
    nav_pattern = r'<b>Navicomputer:</b>\s*([^<]+?)(?:\.|<br />|$)'
    nav_match = re.search(nav_pattern, html)
    if nav_match:
        data['navicomputer'] = nav_match.group(1).strip()
    
    # Consumables
    cons_pattern = r'<b>Consumables:</b>\s*([^<]+?)(?:\.|<br />|$)'
    cons_match = re.search(cons_pattern, html)
    if cons_match:
        data['consumables'] = cons_match.group(1).strip()
    
    # Extract weapons
    weapons = []
    weapon_pattern = r'<li>([^<]+?\([^F])[^<]+?</li>'
    for w in re.findall(weapon_pattern, html):
        if 'Damage' in w:
            weapons.append(w.strip())
    data['weapons'] = weapons
    
    return data

def create_markdown(data, title, template):
    # Set defaults
    for k in ['silhouette', 'speed', 'handling', 'defense_fore', 'defense_port', 
              'defense_starboard', 'defense_aft', 'armor', 'hull_trauma_threshold', 
              'system_strain_threshold']:
        if k not in data:
            data[k] = 0
    
    # Parse price/rarity
    price = 0
    rarity = 0
    restricted = "false"
    if 'price_rarity' in data:
        pr = data['price_rarity']
        # Try to extract price and rarity
        price_match = re.search(r'([\d,]+)\s*credits', pr)
        if price_match:
            price = int(price_match.group(1).replace(',', ''))
        rarity_match = re.search(r'\((\w)\)/(\d+)', pr)
        if rarity_match:
            restricted = "true" if rarity_match.group(1) == 'R' else "false"
            rarity = int(rarity_match.group(2))
        elif re.search(r'/(\d+)', pr):
            rarity_match = re.search(r'/(\d+)', pr)
            rarity = int(rarity_match.group(1))
    
    # Parse encumbrance and passenger capacity
    encumbrance = data.get('encumbrance_capacity', '0')
    try:
        encumbrance = int(encumbrance) if isinstance(encumbrance, str) and encumbrance.isdigit() else 0
    except:
        encumbrance = 0
    
    passengers = data.get('passenger_capacity', '0')
    try:
        passengers = int(passengers) if isinstance(passengers, str) and passengers.isdigit() else 0
    except:
        passengers = 0
    
    # Parse hard points
    hp = data.get('customization_hard_points', '0')
    hp_match = re.search(r'(\d+)', str(hp))
    hard_points = int(hp_match.group(1)) if hp_match else 0
    
    # Get vehicle type (use first section if multiple)
    vehicle_type = data.get('vehicle_type', 'Unknown')
    if '/' in str(vehicle_type):
        vehicle_type = vehicle_type.split('/')[0].strip()
    
    model = data.get('vehicle_type', 'Unknown')
    if '/' in str(model):
        parts = model.split('/', 1)
        if len(parts) > 1:
            model = parts[1].strip()
    
    result = template
    result = result.replace('{{title}}', title)
    result = result.replace('{{subtitle}}', f"{vehicle_type}")
    result = result.replace('{{vehicle_type}}', vehicle_type)
    result = result.replace('{{model}}', model)
    result = result.replace('{{manufacturer}}', data.get('manufacturer', ''))
    result = result.replace('{{sensor_range}}', data.get('sensor_range', ''))
    result = result.replace('{{crew}}', data.get('crew', ''))
    result = result.replace('{{encumbrance_capacity}}', str(encumbrance))
    result = result.replace('{{passenger_capacity}}', str(passengers))
    result = result.replace('{{price}}', str(price))
    result = result.replace('{{restricted}}', restricted)
    result = result.replace('{{rarity}}', str(rarity))
    result = result.replace('{{customization_hard_points}}', str(hard_points))
    result = result.replace('{{silhouette}}', str(data.get('silhouette', 0)))
    result = result.replace('{{speed}}', str(data.get('speed', 0)))
    result = result.replace('{{handling}}', str(data.get('handling', 0)))
    result = result.replace('{{defense_fore}}', str(data.get('defense_fore', 0)))
    result = result.replace('{{defense_port}}', str(data.get('defense_port', 0)))
    result = result.replace('{{defense_starboard}}', str(data.get('defense_starboard', 0)))
    result = result.replace('{{defense_aft}}', str(data.get('defense_aft', 0)))
    result = result.replace('{{armor}}', str(data.get('armor', 0)))
    result = result.replace('{{hull_trauma_threshold}}', str(data.get('hull_trauma_threshold', 0)))
    result = result.replace('{{system_strain_threshold}}', str(data.get('system_strain_threshold', 0)))
    
    # Add weapons section
    weapons_text = ""
    if data.get('weapons'):
        for w in data['weapons']:
            weapons_text += f"- {w}\n"
    
    if not weapons_text.strip():
        weapons_text = "- [Weapon details]"
    
    # Find and replace weapons section
    weapons_section = """## Weapons

- **[Weapon Name]** (Fire Arc: ; Damage: ; Critical: ; Range: ; [Qualities])"""
    if weapons_text.strip() and weapons_text != "- [Weapon details]":
        result = result.replace(weapons_section, f"## Weapons\n\n{weapons_text}")
    
    return result

def main():
    # Load template
    with open(r'E:\Users\Mederic\Documents\Projet\Star Wars FFG\templates\vehicle-template.md', 'r', encoding='utf-8') as f:
        template = f.read()
    
    # Load missing ships
    with open('missing_ships.txt', 'r', encoding='utf-8') as f:
        ships = [line.strip() for line in f if line.strip() and not line.startswith('Missing:')]
    
    # Determine output directory based on ship type
    capital_keywords = ['star destroyer', 'cruiser', 'carrier', 'battleship', 'station', 'fortress', 'destroyer']
    
    created = 0
    failed = []
    
    for i, ship in enumerate(ships):
        print(f"[{i+1}/{len(ships)}] Fetching {ship}...")
        
        result = fetch_vehicle(ship)
        if not result or 'parse' not in result:
            print(f"  Failed to fetch")
            failed.append(ship)
            continue
        
        html = result['parse']['text']['*']
        data = parse_vehicle_html(html)
        
        # Determine category
        is_capital = any(kw in ship.lower() for kw in capital_keywords)
        out_dir = r'E:\Users\Mederic\Documents\Projet\Star Wars FFG\Lore\Vehicles\Capital Ship' if is_capital else r'E:\Users\Mederic\Documents\Projet\Star Wars FFG\Lore\Vehicles\Starship'
        
        # Create filename
        filename = ship.replace('/', '').replace('"', '').replace("'", "").replace('*', '').replace(':', '').replace('\\', '')
        filename = filename.strip()
        filepath = os.path.join(out_dir, f"{filename}.md")
        
        # Create markdown
        md = create_markdown(data, ship, template)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(md)
        
        created += 1
        print(f"  Created: {filename}.md")
    
    print(f"\nDone! Created {created} files, {len(failed)} failed")
    if failed:
        print("Failed ships:")
        for s in failed:
            print(f"  - {s}")

if __name__ == '__main__':
    main()
