function setNestedValue(target, path, value) {
  const parts = path.split('.');
  let current = target;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (i === parts.length - 1) {
      current[part] = value;
    } else {
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
  }
}

export async function fetchButtonDataSheet(url) {
  if (!url) return null;
  try {
    const fetchUrl = url.endsWith('.json') ? url : `${url}.json`;
    const resp = await fetch(fetchUrl);
    if (!resp.ok) return null;
    const json = await resp.json();
    if (!Array.isArray(json.data)) return null;
    const result = {};
    json.data.forEach(({ key, value }) => { if (key) setNestedValue(result, key, value); });
    return result;
  } catch {
    return null;
  }
}