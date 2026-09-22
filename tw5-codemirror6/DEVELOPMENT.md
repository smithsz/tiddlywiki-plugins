# Development Guide

## Project Structure

- `build/` - Build scripts and source files for the CodeMirror 6 bundle
- `plugin/` - TiddlyWiki plugin tiddlers (JavaScript modules, config, UI)
- `test-wiki/` - Test TiddlyWiki instance for development and plugin export

## Making Changes

### 1. Modify Plugin Files

Edit files in the `plugin/` directory:
- `engine.js` - Main engine that integrates with TiddlyWiki
- `edit-codemirror6.js` - Widget factory
- `config/*.tid` - Configuration tiddlers
- `ui/controlpanel/*.tid` - Control panel UI

### 2. Modify CodeMirror Bundle (if needed)

If you need to change the CodeMirror 6 configuration or add features:

1. Edit files in `build/src/`:
   - `bundle-entry.js` - Main bundle entry point
   - `wikitext-lang.js` - WikiText language support
   - `wikitext-completions.js` - WikiText autocompletion

2. Rebuild the bundle:
   ```bash
   cd build
   npm run build
   ```

   This generates `plugin/files/codemirror6-bundle.js` (~721KB)

### 3. Rebuild the Plugin JSON

The plugin is distributed as a single JSON file. To regenerate it:

```bash
cd test-wiki
npx tiddlywiki . --render "$:/temp/export-codemirror6" "output/codemirror6-plugin.json" "text/plain"
cp output/codemirror6-plugin.json ../codemirror6-plugin.json
```

Or as a one-liner from the project root:
```bash
cd test-wiki && npx tiddlywiki . --render "$:/temp/export-codemirror6" "output/codemirror6-plugin.json" "text/plain" && cp output/codemirror6-plugin.json ../codemirror6-plugin.json
```

## Testing

1. Start the test wiki:
   ```bash
   cd test-wiki
   npx tiddlywiki . --listen
   ```

2. Open http://localhost:8080 in your browser

3. Create or edit a tiddler to test the editor

## Adding New Configuration Options

To add a new configuration option (e.g., spell checking):

1. Create a config tiddler in `plugin/config/`:
   ```
   title: $:/config/codemirror6/yourfeature
   type: text/vnd.tiddlywiki
   
   true
   ```

2. Update `plugin/engine.js` to read the config:
   ```javascript
   function getConfig() {
     return {
       // ... existing config
       yourfeature: getBoolConfig(CONFIG_PREFIX + "yourfeature", true)
     };
   }
   ```

3. Update `build/src/bundle-entry.js` to use the config:
   - Add to default settings object
   - Apply the setting in the appropriate place

4. Add UI control in `plugin/ui/controlpanel/codemirror6.tid`:
   ```html
   <$checkbox tiddler="$:/config/codemirror6/yourfeature" field="text" 
              checked="true" unchecked="false" default="true"> 
     Your Feature Description
   </$checkbox>
   ```

5. Rebuild the bundle and plugin JSON (see steps above)

## Dependencies

- Node.js and npm (for building the bundle)
- TiddlyWiki (installed via npx or globally)

## Notes

- The `codemirror6-plugin.json` file is large (~780KB) due to the bundled CodeMirror 6 library
- Don't manually edit the JSON file - always regenerate it from the wiki
- The bundle uses esbuild for fast compilation
