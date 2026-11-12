# HIS staff profile synchronization

## Ownership and timing

Entra authenticates a person. The API links the verified `iss` and `oid` pair to a local `User`; email and display name are not account-link keys. HIS owns the employee's name, employee code, department, job title, branch, employment attributes, termination date, and reporting line. The application owns its role, `isActive` access switch, team membership, workflow permissions, declarations, and approval history.

Synchronization runs during `GET /api/auth/me`, which the SPA calls when it initializes or completes sign-in. It does not call HIS on every protected API request. On first login, the API creates a least-privilege `teamMember` account only after HIS returns exactly one complete record that can be matched to the signed-in identity. Existing linked accounts refresh the HIS-owned fields on each `/me` call. The local role, application enablement, and unrelated app data are omitted from the sync write.

## Lookup and matching rules

- First login requires the signed Entra access token to contain the configured employee identifier claim (`employeeid` by default), then queries `SearchEmployees?employeeId=<claim>`. HIS must return the same non-empty `employeeCode`. Missing claims, zero/multiple results, or a mismatched code do not create a profile. Email and name are never used to match the Entra identity to an HIS record.
- Refresh queries `SearchEmployees?employeeId=<stored teamMemberNumber>`. HIS must return that same non-empty `employeeCode`. The employee code is the durable key after the initial signed-claim match.
- Zero, multiple, incomplete, or mismatched results do not create/update a profile. A local email/employee-code uniqueness conflict is not automatically linked; an administrator must use the existing audited identity-link process.
- If HIS returns a manager employee code, it resolves only to one local user with that code in the same mapped organization. Names are not used to connect manager accounts. If the manager is not provisioned, the manager relation remains absent; team members will not have a manager displayed until the relationship can be safely resolved.

## UAT response mapping

The current UAT envelope accepts `data` as either a single object or a one-element array. Multiple array items are treated as ambiguous. `fUllName` is accepted for the current misspelled property; `fullName` is the preferred spelling for the upstream contract.

| HIS property | Local profile field |
| --- | --- |
| `employeeCode` | `User.teamMemberNumber` |
| `fullName` or current `fUllName` | `User.name` |
| `departmentName` | organization-scoped `Department`, referenced by `User.departmentId` |
| `jobTitle` | `User.position` |
| `branchName` | `User.staffBranchCode` and mapped `User.organizationId` |
| `employmentStatus` | `User.staffEmploymentStatus` |
| `employmentType` | `User.staffEmploymentType` |
| `terminationDate` | `User.staffTerminationDate`; `0001-01-01T00:00:00` is treated as no date |
| `managerEmployeeCode` | `User.managerId` only when one local same-organization account matches |
| `email` | Not used for account matching; local contact email stays as provided by Entra |

`fK_DepartmemntID` is not trusted because the sample returned `0` and the property is misspelled. Department resolution uses the department name within the mapped organization. `managerFullName` is display evidence only; it is not used to link accounts.

## Configuration and rollout

`NodejsBackend/.env` must contain the already-configured endpoint and token plus:

```dotenv
STAFF_PROFILE_SYNC_ENABLED="true"
STAFF_API_ALLOWED_HOSTS="his-api-uat.betsolutions.net"
STAFF_ENTRA_EMPLOYEE_ID_CLAIM="employeeid"
STAFF_BRANCH_ORG_MAP='{"BET":"BET"}'
```

The project seed includes Betsoftware (`BET`) for local development. The deployed database must also have a local `Organization` with short code `BET`; an administrator should create or verify it before enabling sync in that environment. Do not map `BET` to Hollywoodbets (`HB`). For a production HIS endpoint, set `STAFF_API_ENDPOINT` and `STAFF_API_ALLOWED_HOSTS` to its approved HTTPS host and keep redirects disabled. The service refuses non-HTTPS endpoints, hosts outside the allowlist, and requests when `NODE_TLS_REJECT_UNAUTHORIZED=0` is active.

Migrations `0015_his_profile_sync` and `0016_his_termination_date` add nullable fields without changing existing local authorization data. Deploy with `prisma migrate deploy`; do not edit already-applied migrations.

## Expected upstream API contract

The current UAT query parameter contract is `employeeId` for first login and refresh. The API should return HTTP 200, `success: true`, and one record with non-empty `employeeCode`, `fullName`, `departmentName`, `jobTitle`, and `branchName`. `email`, `managerEmployeeCode`, `employmentStatus`, `employmentType`, and `terminationDate` may be null when not applicable. The API may return one object or a one-item `data` array. It should return 404 for no match, 401/403 for invalid service credentials, 429 for throttling, and 5xx for service failure; it should not return an HTTP 200 response with a success-shaped error object.

The sample UAT response with empty `employeeCode`, null email, empty manager code, and department ID `0` is not sufficient to provision an account. After HIS corrects the record, Entra must also issue the employee identifier claim for the API audience. Microsoft warns that `email`, `preferred_username`, and `upn` are mutable and unsuitable for authorization decisions; this integration does not use them for HR identity matching. An Entra administrator must configure the employee identifier as an access-token claim (a tenant-specific employee attribute may require a claims-mapping policy or directory extension) and set `STAFF_ENTRA_EMPLOYEE_ID_CLAIM` to its exact claim name. Microsoft documents optional and custom token claims in [Configure optional claims](https://learn.microsoft.com/en-us/entra/identity-platform/optional-claims) and [Customize tokens](https://learn.microsoft.com/en-us/security/zero-trust/develop/zero-trust-token-customization). A missing manager employee code means the app cannot safely populate the manager relation from the manager's display name alone.

## Operational errors

Failure logs contain a request ID, the `staff_profile_sync` stage, and a reason code; they do not include the bearer token, raw response, or user email. The API returns 503 for disabled/misconfigured/unavailable HIS integration and 403 for a non-unique, incomplete, or identity-mismatched record. After login, check `GET /api/auth/me`; it includes HIS status, branch, employment type, termination date, and the last successful sync timestamp.
