// Generates the same request in every supported language from the OpenAPI operation,
// so all examples stay consistent with each other and with the real contract.
import { examplePath, Operation, requestExample } from './openapi';

export const LANGUAGES = [
  { id: 'curl', label: 'cURL', lang: 'bash' },
  { id: 'javascript', label: 'JavaScript', lang: 'javascript' },
  { id: 'typescript', label: 'TypeScript', lang: 'typescript' },
  { id: 'axios', label: 'Axios', lang: 'javascript' },
  { id: 'python', label: 'Python', lang: 'python' },
  { id: 'php', label: 'PHP', lang: 'php' },
  { id: 'dart', label: 'Dart', lang: 'dart' },
] as const;

export interface Snippet { id: string; label: string; lang: string; code: string }

const BASE = 'https://apasbac-api.vercel.app';
const json = (v: unknown, indent = 2) => JSON.stringify(v, null, indent);
const indentLines = (s: string, pad: string) => s.split('\n').map((l, i) => (i ? pad + l : l)).join('\n');

function pyLiteral(v: unknown, pad = ''): string {
  if (v === null) return 'None';
  if (v === true) return 'True';
  if (v === false) return 'False';
  if (Array.isArray(v)) return `[${v.map((x) => pyLiteral(x, pad)).join(', ')}]`;
  if (typeof v === 'object') {
    const inner = Object.entries(v as object).map(([k, x]) => `${pad}    ${JSON.stringify(k)}: ${pyLiteral(x, pad + '    ')}`);
    return `{\n${inner.join(',\n')}\n${pad}}`;
  }
  return JSON.stringify(v);
}

function phpLiteral(v: unknown, pad = ''): string {
  if (v === null) return 'null';
  if (typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `[${v.map((x) => phpLiteral(x, pad)).join(', ')}]`;
  if (typeof v === 'object') {
    const inner = Object.entries(v as object).map(([k, x]) => `${pad}    '${k}' => ${phpLiteral(x, pad + '    ')}`);
    return `[\n${inner.join(',\n')},\n${pad}]`;
  }
  return typeof v === 'string' ? `'${v.replace(/'/g, "\\'")}'` : String(v);
}

export function buildSnippets(op: Operation): Snippet[] {
  const url = BASE + examplePath(op);
  const auth = !op.isPublic;
  const multipart = op.contentTypes[0] === 'multipart/form-data';
  const body = multipart ? undefined : requestExample(op);
  const fileField = op.path.endsWith('/gallery') ? 'images' : op.path.endsWith('/image') ? 'image' : 'photos';
  const m = op.method;
  const out: Record<string, string> = {};

  // cURL
  const curl = [`curl -X ${m} "${url}"`];
  if (auth) curl.push('  -H "Authorization: Bearer $APASBAC_ACCESS_TOKEN"');
  if (multipart) curl.push(`  -F "${fileField}=@./imagem.jpg"`);
  else if (body) curl.push('  -H "Content-Type: application/json"', `  -d '${json(body)}'`);
  out.curl = curl.join(' \\\n');

  // JavaScript (fetch)
  const jsHeaders = [auth && "Authorization: `Bearer ${accessToken}`", body && "'Content-Type': 'application/json'"].filter(Boolean);
  const jsInit = [`method: '${m}'`,
    jsHeaders.length && `headers: { ${jsHeaders.join(', ')} }`,
    multipart && 'body: form', body && `body: JSON.stringify(${indentLines(json(body), '  ')})`].filter(Boolean);
  const pre = multipart ? `const form = new FormData();\nform.append('${fileField}', fileInput.files[0]);\n\n` : '';
  out.javascript = `${pre}const response = await fetch('${url}', {\n  ${jsInit.join(',\n  ')},\n});\nconst result = await response.json();\nif (!response.ok) throw new Error(Array.isArray(result.message) ? result.message.join('; ') : result.message);\nconsole.log(result.data);`;

  // TypeScript
  out.typescript = `interface ApiSuccess<T> { success: true; data: T; timestamp: string }\ninterface ApiError { success: false; statusCode: number; error: string; message: string | string[]; requestId?: string }\n\n${pre}const response = await fetch('${url}', {\n  ${jsInit.join(',\n  ')},\n});\nconst result = (await response.json()) as ApiSuccess<unknown> | ApiError;\nif (!result.success) throw new Error([result.message].flat().join('; '));\nconsole.log(result.data);`;

  // Axios
  const axHeaders = [auth && "Authorization: `Bearer ${accessToken}`"].filter(Boolean);
  const noBodyVerb = ['get', 'delete'].includes(m.toLowerCase());
  // axios.get/delete take (url, config): a DELETE body goes in config.data.
  const axCfgParts = [noBodyVerb && body && `data: ${indentLines(json(body), '  ')}`, axHeaders.length && `headers: { ${axHeaders.join(', ')} }`].filter(Boolean);
  const axCfg = axCfgParts.length ? `{ ${axCfgParts.join(', ')} }` : '';
  const axArgs = noBodyVerb
    ? [`'${url}'`, axCfg]
    : [`'${url}'`, multipart ? 'form' : body ? indentLines(json(body), '') : 'null', axCfg];
  out.axios = `import axios from 'axios';\n\n${pre}try {\n  const { data } = await axios.${m.toLowerCase()}(${axArgs.filter(Boolean).join(', ')});\n  console.log(data.data);\n} catch (err) {\n  // err.response?.data segue o formato { success: false, statusCode, error, message }\n  console.error(err.response?.status, err.response?.data?.message);\n}`;

  // Python
  const pyArgs = [`"${url}"`, auth && 'headers={"Authorization": f"Bearer {access_token}"}',
    multipart && `files={"${fileField}": open("imagem.jpg", "rb")}`, body && `json=${pyLiteral(body)}`, 'timeout=15'].filter(Boolean);
  out.python = `import requests\n\nresponse = requests.${m.toLowerCase()}(\n    ${pyArgs.join(',\n    ')},\n)\nresult = response.json()\nif not response.ok:\n    raise RuntimeError(result["message"])\nprint(result["data"])`;

  // PHP (ext-curl, no dependencies)
  const phpHeaders = [auth && "'Authorization: Bearer ' . $accessToken", body && "'Content-Type: application/json'"].filter(Boolean);
  const phpOpts = [`CURLOPT_CUSTOMREQUEST => '${m}'`, 'CURLOPT_RETURNTRANSFER => true', 'CURLOPT_TIMEOUT => 15',
    phpHeaders.length && `CURLOPT_HTTPHEADER => [${phpHeaders.join(', ')}]`,
    multipart && `CURLOPT_POSTFIELDS => ['${fileField}' => new CURLFile('imagem.jpg')]`,
    body && `CURLOPT_POSTFIELDS => json_encode(${phpLiteral(body, '    ')})`].filter(Boolean);
  out.php = `<?php\n$ch = curl_init('${url}');\ncurl_setopt_array($ch, [\n    ${phpOpts.join(',\n    ')},\n]);\n$result = json_decode(curl_exec($ch), true);\n$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);\ncurl_close($ch);\n\nif ($status >= 400) {\n    throw new RuntimeException(is_array($result['message']) ? implode('; ', $result['message']) : $result['message']);\n}\nprint_r($result['data']);`;

  // Dart (package:http)
  const dartHeaders = [auth && "'Authorization': 'Bearer $accessToken'", body && "'Content-Type': 'application/json'"].filter(Boolean);
  out.dart = multipart
    ? `import 'dart:convert';\nimport 'package:http/http.dart' as http;\n\nfinal request = http.MultipartRequest('${m}', Uri.parse('${url}'))\n  ..headers['Authorization'] = 'Bearer $accessToken'\n  ..files.add(await http.MultipartFile.fromPath('${fileField}', 'imagem.jpg'));\nfinal response = await http.Response.fromStream(await request.send());\nfinal result = jsonDecode(response.body) as Map<String, dynamic>;\nif (response.statusCode >= 400) throw Exception(result['message']);\nprint(result['data']);`
    : `import 'dart:convert';\nimport 'package:http/http.dart' as http;\n\nfinal request = http.Request('${m}', Uri.parse('${url}'))${dartHeaders.length ? `\n  ..headers.addAll({${dartHeaders.join(', ')}})` : ''}${body ? `\n  ..body = jsonEncode(${indentLines(json(body), '  ')})` : ''};\nfinal response = await http.Response.fromStream(await request.send());\nfinal result = jsonDecode(response.body) as Map<String, dynamic>;\nif (response.statusCode >= 400) throw Exception(result['message']);\nprint(result['data']);`;

  return LANGUAGES.map((l) => ({ id: l.id, label: l.label, lang: l.lang, code: out[l.id] }));
}
