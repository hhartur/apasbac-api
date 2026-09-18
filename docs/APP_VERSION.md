# Política de versão Android

O módulo `src/app-version` usa exclusivamente o manifesto público em
`https://raw.githubusercontent.com/APASBAC/apasbac-app/source/update/version.json`.
Não configure outro `minimumSupportedVersionCode` no servidor. O pipeline do app publica o APK antes do manifesto.

`GET /api/v1/app/version` é público e mantém o envelope padrão da API. Se o GitHub falhar, usa cache válido de cinco minutos e a última resposta persistida na tabela `app_configs`, chave `android_update_stable_manifest_cache`. Sem qualquer cache válido, esse endpoint responde 503 e a política de compatibilidade não bloqueia os outros endpoints. A primeira release ainda não publicada pode retornar 404 no GitHub; isso é esperado.

Depois da autenticação JWT, o interceptor global lê os headers `X-App-Platform: android`, `X-App-Version-Code` (inteiro) e `X-App-Version-Name` (apresentação). Para código abaixo do mínimo, retorna 426:

```json
{
  "success": false,
  "statusCode": 426,
  "error": "APP_UPDATE_REQUIRED",
  "message": "Esta versão do aplicativo não é mais suportada.",
  "latestVersionCode": 12,
  "latestVersionName": "1.4.0",
  "minimumSupportedVersionCode": 8,
  "updateManifestUrl": "https://raw.githubusercontent.com/APASBAC/apasbac-app/source/update/version.json"
}
```

O filtro global preserva esses campos. Clientes web e rotas públicas não são bloqueados. Um cliente declarado Android sem código inteiro válido é tratado como código 0. Clientes antigos que não enviavam nem plataforma não podem ser distinguidos de outros consumidores: instale inicialmente a versão que inclui o atualizador antes de aplicar mínimos. Esses headers não são um mecanismo de autenticação/antiadulteração.

`POST /api/v1/app/update-events` exige JWT e recebe somente `event`, `installedVersionCode`, `targetVersionCode`. Retorna 204, limita 30/minuto e permite versões antigas para registrar falhas. Não registra dados pessoais. Falhas de telemetria não interferem na atualização.

Não editar a chave de cache no painel de configurações; ela é derivada do manifesto validado, não uma política independente. O mínimo publicado não diminui. Rollback exige novo APK com versionCode superior; detalhes de assinatura, Secrets e release estão em `apasbac-app/docs/ANDROID_UPDATES.md` no repositório do aplicativo.

Validação: `npm run prisma:generate`, `npm test`, `npm run lint`, `npx nest build`. O `npm run build` legado também executa `prisma db seed`; não é necessário executar seed para esse módulo, que usa a tabela existente e não requer migration.
