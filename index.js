require('dotenv').config()

const Mbank = require('mbank-api')
const fs = require('fs');
const sleep = require('sleep-promise')
const mailer = require('emailjs')


async function sendNotification(text) {
  const mailServer = mailer.server.connect({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    ssl: false,
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
  fs.writeFileSync("/tmp/lock_balance_checker", 'aaaa', function (err) {
    if (err) {
      return console.log(err);
    }
  });
}

function checkLock() {
  if (fs.existsSync('/tmp/lock_balance_checker')) {
    throw Error('app is locked')
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
  while (true) {
    checkLock()
    const lastKnownBalance = getLastKnownBalance()

    const mbankSession = new Mbank(
      process.env.COUNTRY,
      process.env.USERNAME,
      process.env.PASSWORD,
    )

    try {
      const loginSuccess = await mbankSession.login()
      if (!loginSuccess) {
        throw new Error('login failed')
      }
    } catch (e) {
      lock()
      throw new Error(`login failed: ${e}, locking app`)
    }
    const account = await mbankSession.getAccountByIban(process.env.MBANK_IBAN)

    const currentBalance = parseFloat(account.mAvailableBalance)

    if (lastKnownBalance && currentBalance !== lastKnownBalance) {
      sendNotification(`mBank diff ${currentBalance - lastKnownBalance}; now ${currentBalance}`)
    }

    recordBalance(currentBalance)
    await sleep(5000)
  }
}

run()

