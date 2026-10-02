# Card rail research

SuperTab needs a replaceable rail: USDC on Solana, then a wallet-backed card, then a normal merchant. No provider is wired in. The current implementation is an unavailable rail with no card number and no payment.

Checked in October 2026 from public developer docs. This is not a recommendation to open an account.

## Immersve

- Card issuing API and a public sandbox exist.
- Thailand appears on Immersve's published region list. A partner still has to expose that region.
- Documented USDC chains are Algorand, Arbitrum, Base, Monad, Polygon, and Sei. Solana is not listed.
- Cardholders go through KYC. The sandbox simulator can fund a test card without a chain transfer.
- Blocker: it does not currently fund a card from Solana USDC.

## Crossmint agent cards

- A developer flow can let an agent spend a person's existing Visa or Mastercard through a PCI-hosted card form.
- The published quickstart supports eligible U.S. Visa cards and says non-US Visa cards are not supported.
- This charges a card the person already has. It does not turn Solana USDC into a card.
- Blocker: wrong funding model for SuperTab, and Thailand-issued Visa is outside the stated support.

## Rain through a wallet guide

- Crossmint's card-issuance guide shows a virtual Visa created with Rain's issuing API and collateral held from a Crossmint wallet.
- The sample funding path is EVM (Base Sepolia in the guide), not Solana USDC.
- It needs Rain API access and cardholder onboarding. That is partner and KYC work, not a self-serve switch.
- Blocker: no confirmed Solana USDC funding path, and issuing a card needs owner approval.

## Not chosen

MoonPay was not integrated. Public material reviewed for this pass did not show a third-party Solana USDC card API that could be turned on without a commercial agreement.

No sandbox account was created. Doing so would not unblock Solana USDC, and card issuing would require KYC or a contract.

## What would make a provider fit

The adapter SuperTab actually needs is small: provider status, country and KYC requirements, Solana USDC funding, card status, a payment prepare step, payment evidence, and a separate merchant-order reference. The first useful sandbox is one that can return those states without creating a real card.
