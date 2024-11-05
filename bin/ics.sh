#!/bin/bash

name="$(jq -r .name $1)"
url="$(jq -r .url $1)"
csv="csv/$name.csv"

wget -qO $csv "$url"

echo $url

node ./index.js ics $csv --internal > out/$name-internal.ics
node ./index.js ics $csv > out/$name-public.ics

