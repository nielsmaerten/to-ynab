// @ts-check

const ynab = require("ynab");
const inquirer = require("inquirer");
const fs = require("fs");
const os = require("os");
const path = require("path");
const moment = require("moment");

let configFile = path.join(os.homedir(), ".ynab-config.json");

module.exports = async (transactions, options, data) => {
  if (!options.upload) {
    // Bail if upload is false
    return data;
  }

  // Get config (accessToken and accounts)
  const config = await getConfig();

  // Let user confirm file upload
  const confirmation = await getUploadConfirmation(options.input);
  if (!confirmation) return data;

  // Initialize Uploader
  const ynabHelper = new YnabHelper(config.accessToken);

  // Allow user to select the account
  const { accountId, budgetId } = await selectAccount(config, ynabHelper);

  // Upload to YNAB (only if user has selected an account)
  if (accountId && budgetId) {
    await ynabHelper
      .uploadTransactions(transactions, accountId, budgetId, options)
      .catch(error => {
        console.error("Upload to YNAB failed:", error.error.detail);
      });
  }

  // Finished, pass data to next function in chain
  return data;
};

async function getUploadConfirmation(filename) {
  const confirmation = (await inquirer.prompt([
    {
      type: "confirm",
      name: "confirmation",
      message: `Upload the contents of '${filename}' to YNAB?`
    }
  ])).confirmation;

  return confirmation;
}

/**
 * Select the account from YNAB to be used as a target for uploads,
 * or request the accounts list to be refreshed
 * @param {any} config
 * @param {YnabHelper} ynabHelper
 */
async function selectAccount(config, ynabHelper) {
  const selectedAccount = (await inquirer.prompt([
    {
      type: "list",
      name: "account",
      message: "Which account?",
      choices: [
        {
          name: "[YNAB] >> REFRESH ACCOUNTS",
          value: false
        },
        ...config.accounts.map(b => {
          return {
            name: `[${b.budgetName}] >> "${b.accountName}"`,
            value: {
              budgetId: b.budgetId,
              accountId: b.accountId
            }
          };
        })
      ]
    }
  ])).account;

  if (!selectedAccount) {
    // User wants to refresh the list of accounts
    const updatedAccounts = await updateAccounts(ynabHelper);

    // Update list of accounts, and save
    config.accounts = updatedAccounts;
    writeSettings(config.accessToken, config.accounts);
    return await selectAccount(config, ynabHelper); // Recursion
  }

  return selectedAccount;
}

/**
 * @param {YnabHelper} ynabHelper
 */
async function updateAccounts(ynabHelper) {
  return await ynabHelper.getAccounts();
}

async function askUserForToken() {
  let answers = await inquirer.prompt([
    {
      name: "accessToken",
      message:
        "To upload transactions to YNAB, you'll need a Personal Access Token. " +
        "To create one, visit https://app.youneedabudget.com/settings/developer" +
        "\nPersonal Access Token: ",
      type: "input",
      validate: input => {
        return new Promise(resolve => {
          const testUploader = new YnabHelper(input);
          testUploader.ynabAPI.user
            .getUser()
            .then(() => resolve(true))
            .catch(ex => {
              if (ex.error.id == 401) {
                resolve("Access token is not valid");
              } else {
                resolve("Error: " + ex.error.detail);
              }
            });
        });
      }
    },
    {
      // https://github.com/feathers-plus/generator-feathers-plus/issues/103
      // Workaround for a Win10 bug. This question doesn't do anything
      name: "dummy",
      type: "confirm",
      message: "Token saved. Press Enter to continue."
    }
  ]);

  writeSettings(answers.accessToken);
  console.log("token saved.");
  return answers.accessToken;
}

function writeSettings(accessToken, accounts) {
  accounts = accounts || [];
  fs.writeFileSync(
    configFile,
    JSON.stringify({
      accessToken,
      accounts
    })
  );
}

async function getConfig() {
  let config = {};
  if (fs.existsSync(configFile)) {
    try {
      config = require(configFile);
    } catch {
      fs.unlinkSync(configFile);
    }
  }

  if (!config.accessToken) {
    config.accessToken = await askUserForToken();
    config.accounts = [];
  }

  return config;
}

class YnabHelper {
  /**
   * @param {string} accessToken
   */
  constructor(accessToken) {
    this.ynabAPI = new ynab.API(accessToken);
  }

  /**
   * @param {object[]} transactions
   * @param {string} accountId
   * @param {string} budgetId
   */
  async uploadTransactions(transactions, accountId, budgetId, options) {
    // this object contains keys for every partial importId, and a counter
    // importId = partialImportId + counter
    const transactionCount = {};

    transactions = transactions.map(t => {
      // Date
      let date = moment(t.date, options.dateformat).format("YYYY-MM-DD");

      // Amount
      let amount = Math.floor(t.inflow ? t.inflow * 1000 : -(t.outflow * 1000));

      // Import ID
      let partialImportId = `YNAB:${amount}:${date}`;
      transactionCount[partialImportId] =
        transactionCount[partialImportId] || 1;
      let import_id = `${partialImportId}:${transactionCount[
        partialImportId
      ]++}`;

      return {
        account_id: accountId,
        payee_name: t.payee,
        cleared: ynab.SaveTransaction.ClearedEnum.Cleared,
        approved: false,
        date,
        amount,
        memo: t.memo.substring(0, 200),
        import_id
      };
    });
    await this.ynabAPI.transactions.createTransactions(budgetId, {
      transactions
    });
  }

  async getAccounts() {
    const ynabAPI = this.ynabAPI;
    const accounts = [];

    const budgets = (await ynabAPI.budgets.getBudgets()).data.budgets;
    for (let i = 0; i < budgets.length; i++) {
      const budget = budgets[i];
      const accountsInBudget = (await ynabAPI.accounts.getAccounts(budget.id))
        .data.accounts;
      accountsInBudget.forEach(a => {
        accounts.push({
          accountName: a.name,
          accountId: a.id,
          budgetName: budget.name,
          budgetId: budget.id
        });
      });
    }
    return accounts;
  }
}
