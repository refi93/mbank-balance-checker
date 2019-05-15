require('dotenv').config()

const Mbank = require('mbank-api')
const fs = require('fs');
const sleep = require('sleep-promise')
const mailer = require('emailjs')


async function sendNotification(text) {
  const mailServer = mailer.server.connect({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    ssl: process.env.SMTP_ENABLE_TLS === 'true',
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
  })

  await mailServer.send({
    from: process.env.EMAIL_TO,
    to: process.env.EMAIL_TO,
    subject: text,
    text,
  })
}

function lock() {
  fs.writeFileSync("/tmp/lock_balance_checker", JSON.stringify(new Date()), function (err) {
    if (err) {
      return console.log(err);
    }
  });
}

function checkLock() {
  if (fs.existsSync('/tmp/lock_balance_checker')) {
    console.error('app is locked')
    process.exit(1)
  }
}

function recordBalance(balance) {
  fs.writeFileSync("/tmp/lastbalance", balance, function (err) {
    if (err) {
      return console.log(err);
    }
  });
}

function getLastKnownBalance() {
  try {
    return parseFloat(fs.readFileSync('/tmp/lastbalance', 'utf8'))
  } catch (e) {
    return null
  }
}

async function run() {
  console.log('balance checker started!')
  while (true) {
    checkLock()
    const lastKnownBalance = getLastKnownBalance()

    const mbankSession = new Mbank(
      process.env.COUNTRY,
      process.env.USERNAME,
      process.env.PASSWORD,
    )

    try {
      await mbankSession.login()
    } catch (e) {
      await sleep(600000)
      // if auth failed lock app so the internet banking account does not lock
      //if (e.responseData && e.responseData.successful === false) {
        //lock()
      //}
      //throw new Error(`login failed: ${JSON.stringify(e)}`)
    }
    const account = await mbankSession.getAccountByIban(process.env.MBANK_IBAN)

    const currentBalance = parseFloat(account.mAvailableBalance)

    if (lastKnownBalance && currentBalance !== lastKnownBalance) {
      console.log(`mBank diff ${(currentBalance - lastKnownBalance).toFixed(2)}; now ${currentBalance.toFixed(2)}`)
      sendNotification(`mBank diff ${(currentBalance - lastKnownBalance).toFixed(2)}; now ${currentBalance.toFixed(2)}`)
    }

    recordBalance(currentBalance)
    await sleep(15000)
  }
}

run()

