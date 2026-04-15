This is a professional, streamlined version of the README.md. It removes the icons/emojis and focuses on the technical setup and permission steps required to get the automation running.

***

# CoC War Stats Dashboard

A tactical dashboard for tracking Clash of Clans performance. This project uses a Python scraper and GitHub Actions to automatically update clan and war data every 20 minutes.

## Setup Instructions

### 1. API Credentials
* Register for an account at [developer.clashofclans.com](https://developer.clashofclans.com).
* Create a new API key. Note: We are using the [RoyalAPI](https://docs.royaleapi.com/proxy.html) proxy but you still need the API token from Clash of Clans.
* Copy your API Token.

### 2. GitHub Secrets Configuration
To keep your credentials secure, do not place them in a .env file within the repository. Instead, configure them in GitHub:
* Navigate to your repository on GitHub.
* Go to Settings > Secrets and variables > Actions.
* Click New repository secret and add the following:
    * COC_API_TOKEN: Paste your secret API token.
    * CLAN_TAG: Enter your clan tag including the # symbol.

### 3. Workflow Permissions
The automation requires permission to commit the updated JSON data back to your repository.
* Go to Settings > Actions > General.
* Scroll to the Workflow permissions section.
* Select Read and write permissions.
* Click Save.

### 4. Deployment
* Go to Settings > Pages.
* Under Build and deployment, set Source to Deploy from a branch.
* Select the main branch and the /(root) folder.
* Click Save. Your dashboard will be live at the URL provided by GitHub.

## Automation and Manual Updates
The system is configured to run every 20 minutes via a cron schedule in the GitHub Actions YAML file. 

To trigger an update manually:
* Navigate to the Actions tab in your repository.
* Select the Update Clan Stats workflow from the left sidebar.
* Click the Run workflow dropdown and select Run workflow.

## Technical Requirements
* Python 3.x
* Requests library
* Python-dotenv library
* GitHub Actions enabled
