# Azure Deployment Plan

> **Status:** Planning

Generated: 2026-06-28

---

## 1. Project Overview

**Goal:** Deploy the existing "omni-todo" Node.js application to Azure.

**Path:** Modernize Existing

---

## 2. Requirements

| Attribute | Value |
|-----------|-------|
| Classification | POC / Development / Production |
| Scale | Small / Medium / Large |
| Budget | Cost-Optimized / Balanced / Performance |
| **Subscription** | {subscription-name-or-id} ⚠️ MUST confirm with user |
| **Location** | {azure-region} ⚠️ MUST confirm with user |

---

## 3. Components Detected

| Component | Type | Technology | Path |
|-----------|------|------------|------|
| web | Frontend | React | ./src |
| api | API | Node.js | server.js |

---

## 4. Recipe Selection

**Selected:** AZD

**Rationale:** The Azure Developer CLI (AZD) is the recommended tool for this type of application. It simplifies the process of creating the necessary Azure resources and deploying the application.

---

## 5. Architecture

**Stack:** Containers

### Service Mapping

| Component | Azure Service | SKU |
|-----------|---------------|-----|
| omni-todo | Azure App Service | B1 |

### Supporting Services

| Service | Purpose |
|---------|---------|
| Log Analytics | Centralized logging |
| Application Insights | Monitoring & APM |

---

## 6. Provisioning Limit Checklist

**Purpose:** Validate that the selected subscription and region have sufficient quota/capacity for all resources to be deployed.

> **⚠️ REQUIRED:** This is a **TWO-PHASE** process. Complete both phases before proceeding.

### Phase 1: Prepare Resource Inventory

List all resources to be deployed with their types and quantities. Leave quota/limit columns empty.

| Resource Type | Number to Deploy | Total After Deployment | Limit/Quota | Notes |
|---------------|------------------|------------------------|-------------|-------|
| {ARM-resource-type} | {count} | _To be filled in Phase 2_ | _To be filled in Phase 2_ | _To be filled in Phase 2_ |

**Example format:**

| Resource Type | Number to Deploy | Total After Deployment | Limit/Quota | Notes |
|---------------|------------------|------------------------|-------------|-------|
| Microsoft.App/managedEnvironments | 1 | _TBD_ | _TBD_ | _TBD_ |
| Microsoft.Compute/virtualMachines (Standard_D4s_v3) | 3 | _TBD_ | _TBD_ | _TBD_ |
| Microsoft.Network/publicIPAddresses | 2 | _TBD_ | _TBD_ | _TBD_ |
| Microsoft.DocumentDB/databaseAccounts | 1 | _TBD_ | _TBD_ | _TBD_ |
| Microsoft.Storage/storageAccounts | 2 | _TBD_ | _TBD_ | _TBD_ |

### Phase 2: Fetch Quotas and Validate Capacity

**Action:** **MUST invoke azure-quotas skill first** to populate the remaining columns with actual quota data using Azure quota CLI. Only use fallback methods if quota CLI is not supported.

> **⚠️ IMPORTANT:** Process **ONE resource type at a time**. Do NOT try to apply all steps to all resources at once. Complete steps 1-7 for the first resource, then move to the next resource, and so on.

For each resource type:

1. **Check if quota CLI is supported** - Run `az quota list --scope /subscriptions/{subscription-id}/providers/{ProviderNamespace}/locations/{region}` to verify the provider is supported. If you encounter issues or need help finding the correct resource name, invoke the azure-quotas skill for troubleshooting.
2. **Get current usage and limit**:
   - **If quota CLI is supported**:
     - Get limit: `az quota show --resource-name {quota-resource-name} --scope /subscriptions/{subscription-id}/providers/{ProviderNamespace}/locations/{region}`
     - Get current usage: `az quota usage show --resource-name {quota-resource-name} --scope /subscriptions/{subscription-id}/providers/{ProviderNamespace}/locations/{region}`
   - **If quota CLI is NOT supported** (returns `BadRequest`):
     - Get current usage: `az graph query -q "resources | where type == '{resource-type}' and location == '{location}' | count"` (requires `az extension add --name resource-graph`)
     - Get limit: [Azure service limits documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits)
3. **Calculate total** - Add "Number to Deploy" + current usage = "Total After Deployment"
4. **Verify capacity** - Ensure "Total After Deployment" ≤ "Limit/Quota"
5. **Document source** - Note whether data came from "azure-quotas (resource-name)" or "Azure Resource Graph + Official docs"

**Completed example:**

| Resource Type | Number to Deploy | Total After Deployment | Limit/Quota | Notes |
|---------------|------------------|------------------------|-------------|-------|
| Microsoft.App/managedEnvironments | 1 | 1 | 50 | Fetched from: azure-quotas (ManagedEnvironmentCount) |
| Microsoft.Compute/virtualMachines (Standard_D4s_v3) | 3 | 15 | 350 vCPUs | Fetched from: azure-quotas (standardDSv3Family) |
| Microsoft.Network/publicIPAddresses | 2 | 5 | 100 | Fetched from: azure-quotas (PublicIPAddresses) |
| Microsoft.DocumentDB/databaseAccounts | 1 | 1 | 50 per region | Fetched from: Official docs (quota CLI not supported) |
| Microsoft.Storage/storageAccounts | 2 | 8 | 250 per region | Fetched from: Official docs |

**Status:** ✅ All resources within limits | ⚠️ Near limit (>80%) | ❌ Insufficient capacity

> **⛔ CRITICAL:** You **CANNOT** present this plan to the customer if ANY cells contain "_TBD_" or "_To be filled in Phase 2_". Phase 2 **MUST** be completed with actual quota data before user presentation.

**Notes:**
- **MUST use azure-quotas skill first** to check providers via quota CLI (`az quota` commands) - Microsoft.Compute, Microsoft.Network, Microsoft.App, etc.
- Azure quota CLI is **ALWAYS preferred over REST API** for checking quotas
- **ONLY for unsupported providers** (e.g., Microsoft.DocumentDB returns `BadRequest`), use fallback methods: [Azure service limits documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits)
- If any resource exceeds limits, return to Step 2 to select a different region or request quota increase

---

## 7. Execution Checklist

### Phase 1: Planning
- [ ] Analyze workspace
- [ ] Gather requirements
- [ ] Confirm subscription and location with user
- [ ] Prepare resource inventory (Step 6 Phase 1: list resource types and deployment quantities)
- [ ] Fetch quotas and validate capacity (Step 6 Phase 2: invoke azure-quotas skill to use quota CLI)
- [ ] Scan codebase
- [ ] Select recipe
- [ ] Plan architecture
- [ ] **User approved this plan**

### Phase 2: Execution
- [ ] Research components (load references, invoke skills)
- [ ] **⛔ For Azure Functions: Load composition rules** (`services/functions/templates/selection.md` → `services/functions/templates/recipes/composition.md`) and use `functions_template_get` MCP tool to list and fetch templates, then write `functionFiles[]` + `projectFiles[]` directly — NEVER hand-write Bicep/Terraform and use `azd init -t <template>`/`func init`/`func new` as fallback when composing multiple recipes and required templates are not found
- [ ] For other services: Generate infrastructure files following service-specific guidance
- [ ] Apply recipes for integrations (if needed)
- [ ] Generate application configuration
- [ ] Generate Dockerfiles (if containerized)
- [ ] **⛔ Update plan status to "Ready for Validation"** — Use the `edit` tool to change the Status line in `.azure/deployment-plan.md`. This step is MANDATORY before invoking azure-validate.

### Phase 3: Validation
- [ ] **PREREQUISITE:** Plan status MUST be "Ready for Validation" (Phase 2 last step)
- [ ] Invoke azure-validate skill
- [ ] All validation checks pass
  - [ ] _Replace this with recipe validation steps_
- [ ] Update plan status to "Validated"
- [ ] Record validation proof below

### Phase 4: Deployment
- [ ] Invoke azure-deploy skill
- [ ] Deployment successful
- [ ] Report deployed endpoint URLs
- [ ] Update plan status to "Deployed"

---

## 7. Validation Proof

> **⛔ REQUIRED**: The azure-validate skill MUST populate this section before setting status to `Validated`. If this section is empty and status is `Validated`, the validation was bypassed improperly.

| Check | Command Run | Result | Timestamp |
|-------|-------------|--------|-----------|
| {check-name} | {actual command executed} | ✅ Pass / ❌ Fail | {timestamp} |

**Validated by:** azure-validate skill
**Validation timestamp:** {timestamp}

---

## 8. Files to Generate

| File | Purpose | Status |
|------|---------|--------|
| `.azure/deployment-plan.md` | This plan | ✅ |
| `azure.yaml` | AZD configuration | ⏳ |
| `infra/main.bicep` | Infrastructure | ⏳ |
| `src/{component}/Dockerfile` | Container build | ⏳ |

---

## 9. Next Steps

> Current: {current phase}

1. {next action}
2. {following action}
