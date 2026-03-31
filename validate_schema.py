import json
import re

file_path = r'd:\cheapblinds-shopify\sections\shop-by-type.liquid'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

schema_match = re.search(r'{%\s*schema\s*%}(.*?){%\s*endschema\s*%}', content, re.DOTALL)
if schema_match:
    schema_json = schema_match.group(1).strip()
    try:
        data = json.loads(schema_json)
        print("Schema is valid JSON")
        print(json.dumps(data, indent=2))
    except json.JSONDecodeError as e:
        print(f"Schema is INVALID: {e}")
        print("Schema Content:")
        print(schema_json)
else:
    print("No schema block found")
