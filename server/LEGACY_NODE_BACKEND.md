# Legacy Node backend

The files in this directory are the preserved Node.js/Express backend from before the C# migration. They remain available for rollback and comparison while `../server-dotnet` is ported.

Run this backend explicitly with:

```powershell
npm run dev:api:node-legacy
```

Do not remove or comment out the full source tree. Git history and this isolated legacy entry point provide a reliable rollback without leaving large blocks of dead code in every file.
