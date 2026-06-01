@echo off
chcp 65001 > nul
title ニッチ補助金ファインダー ファイアウォール許可

echo Windowsの管理者確認画面が表示されます。
echo 「はい」を押すと、社内共有用に TCP 39200 の受信を許可します。
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -Verb RunAs -FilePath netsh -ArgumentList @('advfirewall','firewall','add','rule','name=ニッチ補助金ファインダー 39200','dir=in','action=allow','protocol=TCP','localport=39200')"

echo.
echo 管理者確認画面で「はい」を押した場合、設定は完了です。
pause
