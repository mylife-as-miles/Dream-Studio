$ErrorActionPreference = "Continue"

# Rebranding (Case Sensitive)
Write-Host "Starting rebranding..."

# Use a more robust way to exclude directories
$files = Get-ChildItem -Recurse -File | Where-Object { 
    $_.FullName -notmatch "node_modules" -and 
    $_.FullName -notmatch "\.git" -and 
    $_.FullName -notmatch "\.github" -and
    $_.FullName -notmatch "rebrand.ps1"
}

foreach ($file in $files) {
    if ($file.Extension -match "\.(json|ts|tsx|js|jsx|css|scss|html|md|gitignore|mjs|cjs)$") {
        $filePath = $file.FullName
        try {
            $content = [System.IO.File]::ReadAllText($filePath)
            $originalContent = $content
            
            # Replacements
            $content = $content.Replace("@ggez/", "@blud/")
            $content = $content.Replace("ggez-gaming", "blud-gaming")
            $content = $content.Replace("ggez", "blud")
            $content = $content.Replace("GGEZ", "BLUD")
            $content = $content.Replace("Ggez", "Blud")
            $content = $content.Replace("trident", "blob")
            $content = $content.Replace("Trident", "Blob")
            
            if ($content -ne $originalContent) {
                [System.IO.File]::WriteAllText($filePath, $content)
                Write-Host "Updated: $filePath"
            }
        } catch {
            Write-Warning "Failed to process: $filePath"
        }
    }
}

Write-Host "Rebranding complete."
