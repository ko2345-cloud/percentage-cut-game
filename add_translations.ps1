$scriptPath = "c:\Users\tak\Desktop\Percentage_Cut\script.js"
$content = Get-Content $scriptPath -Raw -Encoding UTF8

$translationAdditions = @"

// Add two-player mode translation keys
translations.zh.wins = "Win";
translations.zh.selectMode = "選擇模式：";
translations.zh.singlePlayer = "單人模式";
translations.zh.twoPlayers = "雙人模式";
translations.zh.player1Wins = "玩家1 獲勝！";
translations.zh.player2Wins = "玩家2 獲勝！";
translations.zh.draw = "平手！";
translations.zh.gameOver = "遊戲結束";
translations.zh.finalScore = "最終分數";

translations.en.wins = "Win";
translations.en.selectMode = "Select Mode:";
translations.en.singlePlayer = "Single Player";
translations.en.twoPlayers = "Two Players";
translations.en.player1Wins = "Player 1 Wins!";
translations.en.player2Wins = "Player 2 Wins!";
translations.en.draw = "Draw!";
translations.en.gameOver = "Game Over";
translations.en.finalScore = "Final Score";

"@

# Insert after the translations object but before currentLanguage declaration
$pattern = "(?s)(};\s+)(let currentLanguage)"
$content = $content -replace $pattern, "`$1$translationAdditions`r`n`r`n`$2"

Set-Content $scriptPath -Value $content -Encoding UTF8 -NoNewline

Write-Host "Translation keys added successfully!"
