#!/usr/bin/env node

const fs = require('fs')
const URL = require('node:url')
const path = require('node:path')

const _ = require('lodash')
const pug = require('pug')
const {parse} = require('csv-parse/sync')
const {DateTime} = require('luxon')
const randomColor = require('randomcolor')
const ics = require('ics')
const axios = require('axios')
const Promise = require('bluebird')
const xml2js = require('xml2js')

const PER_PAGE = 8
const DRIVE_ID_REGEX = /d\/(.+)\/view/
const ICON_PATH = path.join(__dirname, 'icons')
const MAX_TITLE_SIZE = 4.7
const MIN_TITLE_SIZE = 2.5

async function render(argv){
  let tpl = pug.compileFile('template.pug', {pretty: true})
  let rows = parse(fs.readFileSync(argv.csv), {columns: true})

  let events = await Promise.mapSeries(rows, async row => {
    let date = DateTime.fromISO(row.DATE)
    let start = DateTime.fromISO(row['START']).toFormat('h:mma')
    let icon

    if (fs.accessSync(`${ICON_PATH}/${row.ICON}.svg`, fs.constants.R_OK) == null){
      icon = fs.readFileSync(`${ICON_PATH}/${row.ICON}.svg`)

      let parser = new xml2js.Parser()
      let svgData = await parser.parseStringPromise(icon)
      delete svgData.svg['$'].fill
      delete svgData.svg['$'].height
      delete svgData.svg['$'].width
      delete svgData.svg['$'].style
      delete svgData.svg.style
      _.set(svgData, 'svg.path[0].$.fill', null)

      let builder = new xml2js.Builder()
      icon = builder.buildObject(svgData)
    }
    else {
      console.warn(`Icon not found: ${row.ICON}`)
    }

    let titleSize = -0.1671533 * row.TITLE.length + 8.5
    if (titleSize > MAX_TITLE_SIZE){
      titleSize = MAX_TITLE_SIZE
    }
    if (titleSize < MIN_TITLE_SIZE){
      titleSize = MIN_TITLE_SIZE
    }

    let marginSize = titleSize / 8.5

    let eventType = row.TYPE
    if (row.SUBTYPE){
      eventType += ` - ${row.SUBTYPE}`
    }

    let color = row.HEX === 'random' ? randomColor({luminosity: 'dark'}) : row.HEX

    return {
      date,
      dow: date.toFormat('ccc'),
      day: date.toFormat('d'),
      type: eventType,
      name: row.TITLE,
      icon,
      start: row.END ? `${start}-`: start,
      end: row.END ? DateTime.fromISO(row.END).toFormat('h:mma'): '',
      color,
      size: `${titleSize}em`,
      marginSize: `${marginSize}em`
    }

//    let driveId = row.ICON.match(DRIVE_ID_REGEX)[1]
//    let resp = await axios.get('https://drive.google.com/uc', {
//      params: {
//        export: 'download',
//        id: driveId,
//        confirm: 'yes'
//      }
//    })
  })

  let pages = _.chunk(events, argv.pageSize)

  let info = {
    title: pages[0][0].date.toFormat('LLLL yyyy')
  }

  console.log(tpl({pages, info}))
}

function generateIcs(argv){
  let rows = parse(fs.readFileSync(argv.csv), {columns: true})

  let events = rows.map(row => {
    let date = DateTime.fromISO(row.DATE)
    let start = DateTime.fromISO(row['START'])
    let end = row.END ? DateTime.fromISO(row['END']): start.plus({hours: 2})
    let diff = end.diff(start, ['hours', 'minutes'])

    if (argv.internal){
      return {
        title: row.TITLE,
        start: [date.year, date.month, date.day, start.hour, start.minute],
        duration: {hours: diff.hours, minutes: diff.minutes},
        location: row.LOCATION
      }
    }

    return {
      title:`[${row.TYPE}] ${row.TITLE}`,
      start: [date.year, date.month, date.day, start.hour, start.minute],
      duration: {hours: diff.hours, minutes: diff.minutes},
      description: row.DESC,
      location: row.LOCATION
    }
  })

  let {error, value} = ics.createEvents(events)
  console.log(value)
}

async function run(){
  await require('yargs')
    .command('render <csv>', '', {}, render)
    .command('ics <csv>', '', {}, generateIcs)
    .option('internal', {type: 'boolean', default: false})
    .option('page-size', {type: 'number', default: PER_PAGE})
    .parse()
}

run()
