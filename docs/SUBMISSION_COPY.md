# SuperTab submission copy

This file is an earlier draft. Do not paste it into the form. The current form text is `submission/FINAL_SUBMISSION_TEXT.md`, checked against the live desk on 11 October 2026. Claims below about a confirmed mainnet conversion, a private repository, or an October 12 due date are historical and are not the current submission.

Draft for review. Keep the personal wording, and confirm the contributor field before submitting. No form has been submitted.

## Brief description

SuperTab is an AI shopping agent that helps people use their Solana wallet to plan everyday purchases. It finds products from Shopify and eBay, reads wallet balances, and shows how SOL could cover a USDC shortfall through DFlow. The prototype includes a confirmed mainnet conversion and a separate devnet checkout with a verified order and refund. Card payments to ordinary retailers are the next step.

## What are you building, and who is it for?

I’m building SuperTab for people who already hold crypto but still shop on regular websites. They should be able to describe what they want, compare real products, and understand how their wallet could fund a purchase without jumping between several apps. SuperTab brings product discovery, wallet balances, and a funding review into one place. Today, the prototype searches Shopify and eBay listings, reads Solana balances, and reviews DFlow conversion quotes. I have also tested a mainnet SOL-to-USDC conversion and a separate devnet merchant payment and refund. My next step is connecting a card payment rail so regular merchants can receive a normal card payment.

## Why did you decide to build this, and why build it now?

I wanted to make crypto more useful for everyday purchases. Holding assets in a wallet is straightforward, but buying something online still means finding a product, checking balances, converting assets, and working out how to pay the merchant. I’m building SuperTab to bring those steps together while keeping the user in control of every transaction. AI can help people describe and narrow down what they want, while Solana, USDC, and DFlow provide the pieces for funding. This prototype is my way of testing whether those pieces can become a shopping experience people would actually use.

## What technologies are you using or integrating with?

Next.js, React, TypeScript, a Gemini integration for the shopping assistant (the public site uses the server-only Gemini key; the structured text parser remains the fallback), Shopify Catalog MCP and eBay Browse for discovery, Solana RPC for wallet and transaction reads, Wallet Standard and Phantom for connection and signatures, USDC, and DFlow for conversion quotes. A separate devnet merchant service supports checkout and refunds and is hosted for the public site. I use OpenAI Codex for development and debugging, with Vitest, TypeScript, ESLint, and production builds for verification. Card payment rails are still an integration goal.

## Which chains does your product use?

Select Solana. The Bitcoin timestamp integration is incomplete and is not a verified feature of this submission.

## How does your product use these chains?

SuperTab reads SOL and USDC balances on Solana and uses DFlow to review funding conversions. A mainnet SOL-to-USDC conversion has been confirmed. A separate devnet merchant checkout demonstrates a USDC payment, order record, and refund. Quotes, wallet connection, and message ownership checks are kept separate from transaction approval. Retail checkout remains quote-only; the mainnet timestamp merchant payment has not settled.

## Category

AI Platforms / Agents

## Location and contact

Country: Thailand
Telegram: @James_StarAtlas
X: https://x.com/noisesang
Mobile-focused dApp: leave unchecked for the current web prototype.

## Did anyone not listed on the team do meaningful work?

[Confirm any human contributors before submitting.] I used OpenAI Codex to help with implementation, debugging, and tests. I directed the product choices and reviewed the work.

## Anything else judges should know?

The demo separates verified results from planned integrations. It includes real product discovery and wallet reads, a confirmed mainnet conversion, and a separate devnet order and refund. The retail quote did not create a retail order. Card checkout is not connected, and the timestamp merchant integration has no verified settlement or certificate. Existing records can be inspected without signing a new transaction.

## Repository context

This repository contains the SuperTab Next.js app, Solana wallet and DFlow adapters, and a separate devnet merchant service. The public site reads that merchant from its hosted URL. Local review can still run the merchant on 127.0.0.1:8787. It includes tests and startup documentation. The demo separates retail quotes, mainnet conversion evidence, and devnet orders. Card checkout is planned; the timestamp merchant payment remains incomplete. Secrets and private payment recovery data are excluded from Git.

## Access instructions

Open https://supertab-main.vercel.app. Shopping and the existing devnet order do not require a wallet signature. The devnet page reads the hosted test merchant. Keep mainnet execution disabled. No new payment, refund, or wallet signature is required to review the preserved records.

For local review, use Node.js 20.19+ and follow README.md. Run npm ci, then npm run merchant and npm run dev in separate terminals. Open http://localhost:3000. A browser with Phantom is needed only for interactive wallet tests. Seeker hardware was not part of this hosted check.

## Links and media still needed

GitHub: https://github.com/Kleangkao/supertab — public as of 11 October 2026. Do not change visibility.
Project website/live product: https://supertab-main.vercel.app
Demo video: YouTube, Loom, or Vimeo, up to 3 minutes showing the live product.
Pitch video: separate video up to 2 minutes introducing you, the product, and why you are building it.
Logo/graphic: upload your project image.
Team: complete your member profile before submission.

