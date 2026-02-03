$originalPath = "c:\Users\tak\Desktop\Percentage_Cut\script_clean_backup.js"
$newPath = "c:\Users\tak\Desktop\Percentage_Cut\script.js"

# Read the original clean file
$lines = [System.IO.File]::ReadAllLines($originalPath, [System.Text.Encoding]::UTF8)

# We'll create a new array with modifications
$newLines = New-Object System.Collections.ArrayList

$i = 0
while ($i -lt $lines.Count) {
    $line = $lines[$i]
    
    # 1. After line with "let currentLanguage = 'zh';" add translation keys (English only)
    if ($line -match "let currentLanguage = 'zh';") {
        [void]$newLines.Add($line)
        [void]$newLines.Add("")
        [void]$newLines.Add("// Two-player mode translation keys")
        [void]$newLines.Add("translations.zh.wins = `"Win`";")
        [void]$newLines.Add("translations.zh.selectMode = `"Mode:`";")
        [void]$newLines.Add("translations.zh.singlePlayer = `"Single`";")
        [void]$newLines.Add("translations.zh.twoPlayers = `"Two Player`";")
        [void]$newLines.Add("translations.zh.player1Wins = `"P1 Wins!`";")
        [void]$newLines.Add("translations.zh.player2Wins = `"P2 Wins!`";")
        [void]$newLines.Add("translations.zh.draw = `"Draw!`";")
        [void]$newLines.Add("translations.zh.gameOver = `"Game Over`";")
        [void]$newLines.Add("translations.zh.finalScore = `"Final Score`";")
        [void]$newLines.Add("")
        [void]$newLines.Add("translations.en.wins = `"Win`";")
        [void]$newLines.Add("translations.en.selectMode = `"Select Mode:`";")
        [void]$newLines.Add("translations.en.singlePlayer = `"Single Player`";")
        [void]$newLines.Add("translations.en.twoPlayers = `"Two Players`";")
        [void]$newLines.Add("translations.en.player1Wins = `"Player 1 Wins!`";")
        [void]$newLines.Add("translations.en.player2Wins = `"Player 2 Wins!`";")
        [void]$newLines.Add("translations.en.draw = `"Draw!`";")
        [void]$newLines.Add("translations.en.gameOver = `"Game Over`";")
        [void]$newLines.Add("translations.en.finalScore = `"Final Score`";")
        $i++
        continue
    }
    
    # 2. Replace split-screen-line querySelector with getElementById
    if ($line -match "const splitLine = document\.querySelector\('\.split-screen-line'\);") {
        [void]$newLines.Add("        const splitLine = document.getElementById('splitLine');")
        $i++
        continue
    }
    
    # 3. Replace player-info display logic for multi-player
    if ($line -match "document\.querySelectorAll\('\.player-info'\)\.forEach\(el => el\.style\.display = 'block'\);") {
        [void]$newLines.Add("        document.getElementById('p2UI').style.display = 'flex';")
        [void]$newLines.Add("        document.getElementById('p1-winsBox').style.display = 'block';")
        [void]$newLines.Add("        document.getElementById('p2-winsBox').style.display = 'block';")
        $i++
        continue
    }
    
    # 4. Replace player-info display logic for single-player
    if ($line -match "document\.querySelectorAll\('\.player-info'\)\.forEach\(el => el\.style\.display = 'none'\);") {
        [void]$newLines.Add("        document.getElementById('p2UI').style.display = 'none';")
        [void]$newLines.Add("        document.getElementById('p1-winsBox').style.display = 'none';")
        [void]$newLines.Add("        document.getElementById('p2-winsBox').style.display = 'none';")
        $i++
        continue
    }
    
    # 5. Add WIN display code after levelEl update in updateUI
    if ($line -match "^\s+if \(levelEl\) levelEl\.textContent = currentLevel;") {
        [void]$newLines.Add($line)
        [void]$newLines.Add("")
        [void]$newLines.Add("    // Update WIN count for two-player mode")
        [void]$newLines.Add("    if (gameMode === 'multi') {")
        [void]$newLines.Add("        const winsEl = document.getElementById(prefix + 'wins');")
        [void]$newLines.Add("        const totalWins = player.id === 0 ? p1TotalWins : p2TotalWins;")
        [void]$newLines.Add("        if (winsEl) winsEl.textContent = totalWins;")
        [void]$newLines.Add("    }")
        $i++
        continue
    }
    
    # 6. Add updateUI call after p2TotalWins update in endLevel
    if ($line -match "^\s+p2TotalWins \+= p2\.wins;") {
        [void]$newLines.Add($line)
        [void]$newLines.Add("")
        [void]$newLines.Add("    // Update WIN displays")
        [void]$newLines.Add("    updateUI();")
        $i++
        continue
    }
    
    # 7. Update version number
    if ($line -match "Game Version: v2\.8") {
        [void]$newLines.Add($line -replace "v2\.8", "v2.9")
        $i++
        continue
    }
    
    # Default: keep the line as-is
    [void]$newLines.Add($line)
    $i++
}

# Write the new file with UTF8 encoding without BOM
[System.IO.File]::WriteAllLines($newPath, $newLines, (New-Object System.Text.UTF8Encoding $false))

Write-Host "Script rebuilt successfully!"
Write-Host "- Added English-only translation keys"
Write-Host "- Updated UI visibility controls"  
Write-Host "- Added WIN display logic"
Write-Host "- Updated version to v2.9"
Write-Host "- No Chinese characters or emojis added"
