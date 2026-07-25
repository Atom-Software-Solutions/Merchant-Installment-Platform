# Merchant Installment Platform
> Version 1.0

## Overview

The Merchant Installment Platform enables merchants to sell products on flexible payment terms while allowing customers to track their purchases and payment progress.

Unlike a traditional e-commerce platform, customers do not browse a public catalog. Instead, merchants assign products directly to customers, who then make installment payments until the purchase is fully paid.

---

# Goals

- Enable merchants to manage installment-based sales.
- Allow customers to track payment progress.
- Support product collection after a configurable minimum payment.
- Provide transparency between merchants and customers.
- Maintain a complete payment history for every sale.

---

# Core Users

## Merchant

Merchants can:

- Manage products
- Manage inventory
- Invite and manage customers
- Create installment sales
- Record customer payments
- Track outstanding balances
- View reports

---

## Customer

Customers can:

- View assigned purchases
- Track payment progress
- View payment history
- Download receipts
- Know when a product is ready for collection
- View remaining balances

---

# Core Workflow

```text
Merchant
    ↓
Create Product
    ↓
Create Sale
    ↓
Assign Customer
    ↓
Customer Account
    ↓
Payment Plan
    ↓
Installment Payments
    ↓
Collection Eligibility
    ↓
Product Collected
    ↓
Sale Completed
```

---

# Business Flow

## 1. Merchant Onboarding

A merchant creates an account and sets up:

- Business information
- Branches (optional)
- Staff members
- Payment methods

---

## 2. Product Management

Merchants create reusable products.

Example:

- Name
- Description
- Price
- Images
- Stock Quantity
- Status

Products belong to a catalog and can be sold multiple times.

---

## 3. Customer Management

Customers can be:

- Invited by Email
- Invited by WhatsApp
- Linked to an existing account

A customer only sees purchases assigned to them.

---

## 4. Sale Creation

A Sale represents an agreement between a merchant and a customer.

Each sale contains:

- Product
- Customer
- Selling Price
- Payment Plan
- Collection Rule
- Sale Status

---

## 5. Payment Plan

Each sale includes payment terms such as:

- Total Price
- Minimum Collection Amount
- Payment Duration
- Expected Installments

---

## 6. Payments

Payments are recorded against a Sale.

Each payment records:

- Amount
- Date
- Payment Method
- Recorded By
- Receipt Number

Both merchant and customer can view the payment history.

---

## 7. Collection

A product becomes eligible for collection once the required minimum payment has been reached.

Possible statuses:

- Not Eligible
- Eligible
- Collected

The customer may continue paying after collecting the product until the balance reaches zero.

---

## 8. Sale Completion

A sale is completed when:

- Product has been collected
- Remaining balance equals zero

---

# Sale Statuses

| Status | Description |
|---------|-------------|
| Pending | Sale created but not yet active |
| Active | Customer is making payments |
| Eligible | Product can be collected |
| Collected | Customer has received the product |
| Completed | Fully paid |
| Cancelled | Sale cancelled |
| Defaulted | Customer failed to continue payments |

---

# Key Business Rules

- Products belong to merchants.
- Products can be sold multiple times.
- Customers only see purchases assigned to them.
- Payments belong to a Sale, not directly to a Product.
- Collection is based on the minimum collection amount.
- Full payment is required before a sale is completed.
- Merchants can have multiple staff members.
- A customer may have multiple active purchases.

---

# Future Enhancements

- Online payments
- SMS & WhatsApp reminders
- Automatic payment schedules
- Customer credit history
- Late payment penalties
- Discounts and promotions
- Multi-branch inventory
- Advanced analytics & reporting

---

# Domain Model

```text
Merchant
    │
    ├── Staff
    ├── Branches
    ├── Products
    ├── Customers
    └── Sales
            │
            ├── Payment Plan
            ├── Payments
            ├── Receipts
            └── Collection Status
```

---

# Design Principles

- Merchant-first experience
- Simple customer journey
- Flexible payment plans
- Transparent payment tracking
- Reusable product catalog
- Scalable multi-merchant architecture
