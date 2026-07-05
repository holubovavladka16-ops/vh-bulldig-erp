# VH Bulldig ERP – publikace na GitHub + Vercel
# Spusťte v PowerShell z kořene projektu (vedle package.json).

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$git = "C:\Program Files\Git\bin\git.exe"
$gh = "C:\Program Files\GitHub CLI\gh.exe"

Write-Host "=== 1/4 GitHub přihlášení ===" -ForegroundColor Cyan
& $gh auth login --hostname github.com --git-protocol https --web

Write-Host "`n=== 2/4 Vytvoření repozitáře a push ===" -ForegroundColor Cyan
$repoName = "vh-bulldig-erp"
& $gh repo create $repoName --private --source=. --remote=origin --push

Write-Host "`n=== 3/4 Vercel přihlášení a deploy ===" -ForegroundColor Cyan
npx vercel login
npx vercel link --yes
npx vercel env add VITE_SUPABASE_URL production
npx vercel env add VITE_SUPABASE_ANON_KEY production
npx vercel env add VITE_INITIAL_ADMIN_EMAIL production
npx vercel --prod --yes

Write-Host "`n=== 4/4 Hotovo ===" -ForegroundColor Green
Write-Host "Produkční URL najdete ve výstupu Vercel (https://....vercel.app)"
Write-Host "Volitelně: vercel domains add erp.vhbulldig.cz"
Write-Host "Nezapomeňte aplikovat migrace na Supabase Cloud (npm run setup-complete)."
