# programming standard

## Code Quality & Principles
- Write clean, DRY (Don't Repeat Yourself) code with single responsibility principle
- Use meaningful variable and function names that explain intent without comments
- Keep functions small (max 20 lines), focused on one task
- Follow TypeScript/JavaScript best practices: const/let (never var), arrow functions, async/await
- Implement proper error handling with try-catch blocks and meaningful error messages
- Use type hints/JSDoc comments for function parameters and return types

## Code Style (Deno/Node.js)
- Use 2-space indentation consistently
- Format code with meaningful whitespace for readability
- Keep lines under 100 characters
- Use camelCase for variables/functions, PascalCase for classes/types
- Add JSDoc comments for exported functions explaining purpose, params, and return

## Data Processing
- Validate input data before processing
- Use map/filter/reduce for clean data transformations
- Separate data fetching from data processing logic
- Implement retry logic for network requests (max 3 attempts with exponential backoff)
- Use structured logging for debugging
- Remove Any quote in paragraph string \"

## Performance & Best Practices
- Cache frequently accessed data
- Use batch operations when available
- Implement rate limiting to respect API limits (500ms between requests)
- Use async operations instead of blocking calls
- Monitor and log execution time for heavy operations

## Testing & Documentation
- Write self-documenting code with clear logic flow
- Add usage examples in JSDoc for complex functions
- Include error handling scenarios in code comments
- Create clear README sections for each script's purpose

# fetchDetails
for each data details you get, adds this data to the already existing json file in "Assets/scripts/fandom/list"

## exclude
- the Agent need to remove this string from is data at all time "More information about the armor available on the Wookieepedia article."
- the Agent need to store paragraph in text without any link reference from the source.
- the Agent need to remove any <sup> reference during the fetching and scrapping

## book source
For each books sources you see in the CSS selector ".mw-references-wrap .references" you need to make it fit with Assets/scripts/fandom/list/books.json
- look in util.ts file they are global function to use to format books source correctly
- remove the <sup> item in the books source
- in the json output add page_number and add the page number or first page of a groups (page 30-32) be 30

## Example
on the URL https://star-wars-rpg-ffg.fandom.com/wiki/Reflect_Body_Glove
- subtitle: A reflect body glove is a skintight suit that can be worn underneath traditional garments. 
- description: Add two setback dice to a character's Vigilance and Perception checks to notice the user is wearing armor. After a successful combat check has been resolved against the wearer, the reflect body glove's soak is reduced by one, to a minimum of zero. The suit's soak may be restored to its original value by making an Average difficulty Mechanics check.