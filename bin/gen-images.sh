#!/bin/bash

PER_PAGE=8

chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
name="$(jq -r .name $1)"
url="$(jq -r .url $1)"
csv="csv/$name.csv"

wget -qO $csv "$url"

echo $url

num_events="$(csvstat --count $csv)"
num_pages=$((num_events / PER_PAGE))

for i in $(seq $num_pages); do
  node ./index.js render $csv --page $i > out/$name-$i.html

  "$chrome" \
    --disable-gpu \
    --headless \
    --screenshot=out/$name-$i.png \
    --window-size=1110,1300 \
    out/$name-$i.html \
    &> /dev/null

  magick out/$name-$i.png -gravity south -chop 0x190 out/$name-$i.png

  echo "Generated out/$name-$i.png"
done

