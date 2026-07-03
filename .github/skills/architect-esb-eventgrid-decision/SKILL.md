# Azure Backend Messaging Decision Instructions: ESB vs Event Grid

## Purpose

Use this instruction when designing or reviewing Azure backend services that require asynchronous communication, service decoupling, pub/sub integration, event-driven processing, or enterprise message routing.

The goal is to help the GitHub Copilot agent recommend the correct Azure integration pattern between:

- **ESB / Azure Service Bus**
- **Azure Event Grid**

The agent must evaluate the business intent, processing model, reliability needs, payload expectations, subscriber relationship, and operational requirements before recommending a messaging approach.

---

## Primary Decision Rule

Use the following rule as the default architectural guidance:

> Use **Azure Service Bus / ESB** for commands, work queues, business messages, and reliable workflow coordination.  
> Use **Azure Event Grid** for state-change events, lightweight notifications, fan-out delivery, serverless reactions, and loosely coupled event distribution.

Do not treat Event Grid and Service Bus as interchangeable. They solve different integration problems.

---

## Architectural Decision Matrix

When evaluating a backend integration requirement, apply the following criteria.

### 1. Business Intent

#### Choose ESB / Azure Service Bus when:

- The sender is asking another service to complete the business transaction.
- The message represents a command, task, or complete business document.
- The producer expects the consumer to take a specific action.
- The integration is part of an operational workflow, with critical dependencies to complete transaction updates.

Examples:

```text
CapturePaymentRequested
GenerateInvoiceRequested
CreateRentalAgreementRequested
SyncCustomerToERPRequested
```

#### Choose Event Grid when:

- The criteria for ESB is not met
- The message represent just a notification of an event , which already took place, such as status or business record changes

Examples:

```text
CapturePaymentSuccessful
RentalAgreementCreated
```

