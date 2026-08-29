# Step-by-Step: Deploying to Render.com

Because we created the `render.yaml` file (Infrastructure as Code), deploying this bot to Render is mostly automated. Follow these exact steps to get your dashboard live on the internet.

## Phase 1: Push Code to GitHub
Render needs a place to pull your code from.
1. Log into your GitHub account and create a new **Private** repository (e.g., `ibkr-trading-dashboard`). *Keep it private so your trading logic isn't public!*
2. Open your terminal on your Mac and push your local code to GitHub:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/ibkr-trading-dashboard.git
   git push -u origin main
   ```
*(If your branch is named `master`, use `git push -u origin master` instead).*

## Phase 2: Connect to Render
1. Go to [Render.com](https://render.com) and sign in (using your GitHub account is easiest).
2. On the Render Dashboard, click the **"Blueprints"** tab on the top navigation bar.
3. Click the **"New Blueprint Instance"** button.
4. Render will ask you to connect your GitHub account. Do so, and select the `ibkr-trading-dashboard` repository.
5. Render will automatically scan your repository, find the `render.yaml` file we created, and say: *"We found 1 Web Service (ibkr-bot)"*. 
6. Click **Apply**.

## Phase 3: Injecting Your Secure Variables
Because we configured `render.yaml` to require environment variables, Render will immediately pause and ask you to fill in the blanks before it builds the server.

You will see input boxes for:
- **`TWS_USERID`**: Enter your Interactive Brokers Paper Trading username.
- **`TWS_PASSWORD`**: Enter your Interactive Brokers password.
- **`DASHBOARD_USER`**: Create a custom username for your web dashboard.
- **`DASHBOARD_PASS`**: Create a strong password for your web dashboard.

*(Render encrypts these, so they are perfectly safe and never exposed in your codebase).*

Click **Save and Deploy**.

## Phase 4: First Time Verification (2FA)
Render will now pull your Docker container, build it, and start it. You can watch the live terminal logs on the Render dashboard.

1. Watch the logs. Eventually, you will see `Starting IB Gateway via IBC...`
2. **Because this is a brand new server/IP address**, Interactive Brokers will likely trigger 2-Factor Authentication (2FA) on your phone.
3. Check your phone's IBKR app for a login notification and approve it.
4. Once approved, the logs will show `Connection successful`.

## Phase 5: Access Your Dashboard
1. On the Render dashboard, you will see a public URL generated for your app (e.g., `https://ibkr-bot-xyz123.onrender.com`).
2. Click that URL.
3. Your browser will prompt you for a Username and Password (this is the Basic Authentication we built!). 
4. Enter the `DASHBOARD_USER` and `DASHBOARD_PASS` you set in Phase 3.
5. Your React Dashboard will load, fully connected to your live IBKR account!
