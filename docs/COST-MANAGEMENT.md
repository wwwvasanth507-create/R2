# Cost Optimization & Infrastructure Budget Management

## 1. Cloudflare R2 Free Tier & Pricing Model
*Verification Date: Current official documentation standards.*

| Resource | Free Tier Allowance (per month) | Paid Tier Rate Beyond Free Tier |
|---|---|---|
| **Storage** | 10 GB (10,737,418,240 bytes) | $0.015 / GB-month |
| **Class A Operations** (Writes, Lists, Uploads) | 1,000,000 requests | $4.50 / 1,000,000 requests |
| **Class B Operations** (Reads, Head requests) | 10,000,000 requests | $0.36 / 1,000,000 requests |
| **Data Egress** (Bandwidth) | **UNLIMITED / $0.00** | **$0.00 / GB** (Free Egress!) |

> [!TIP]
> Cloudflare R2's zero data egress fees make it uniquely economical for high-bandwidth video streaming compared to AWS S3, which charges \$0.09/GB for internet egress.

---

## 2. Multi-Account Cost Modeling & Budget Safeguards
1. **Configurable Budgets**: Every registered Cloudflare account has a configured `monthly_budget_usd` field.
2. **Proactive Cost Projection**:
   $$\text{Estimated Cost} = \max(0, \text{GB Stored} - 10) \times \$0.015 + \max(0, \text{Class A} - 1\text{M}) \times \frac{\$4.50}{10^6} + \max(0, \text{Class B} - 10\text{M}) \times \frac{\$0.36}{10^6}$$
3. **Automated Allocation Halt**:
   When an account's estimated monthly cost reaches 95% of its configured budget, the allocation engine immediately marks its associated buckets as `EXHAUSTED_100`, preserving existing media while routing all new chunk allocations to alternative authorized accounts.
4. **No Unexpected Incurred Fees**:
   Under no circumstances does the backend provision paid cloud resources without explicit administrative confirmation.

---

## 3. Storage Optimization Tactics
- **Adaptive Bitrate Tuning**: Transcoding targets efficient H.264/AAC bitrates with aggressive B-frame compression.
- **Story Lifecycle Expiration**: Instagram-style stories automatically age out after 24 hours, freeing storage capacity.
- **Deduplication**: SHA-256 checks on files prevent duplicate uploads of identical media.
