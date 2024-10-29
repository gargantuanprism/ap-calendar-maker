#!/bin/bash

name=$(basename "$1" .csv)
nodemon -e js,css,pug,csv -x "node index.js render $1 --page 1 | tee out/$name.html"

