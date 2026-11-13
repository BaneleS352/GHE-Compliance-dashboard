# HIS staff profile synchronization

## Ownership and timing

Entra authenticates a person. The API links the verified `iss` and `oid` pair to a local `User`; email and display name are not account-link keys. HIS owns the employee's name, employee code, department, job title, branch, employment attributes, termination date, and reporting line. The application owns its role, `isActive` access switch, team membership, workflow permissions, declarations, and approval history.

Synchronization runs during `GET /api/auth/me`, which the SPA calls when it initializes or completes sign-in. It does not call HIS on every protected API request. On first login, a complete matching HIS record creates and populates a least-privilege `teamMember` account. If HIS returns no match or an optional HIS request fails, the API creates a minimal account or preserves the existing profile so authentication can continue; that user may still need profile completion before creating a declaration. Existing linked accounts refresh HIS-owned fields on each `/me` call when a complete matching record is available. The local role, application enablement, and unrelated app data are omitted from the sync write.

## Lookup and matching rules

- The SPA acquires a separate delegated Microsoft Graph token with `User.Read` and sends it only on `GET /api/auth/me`; the normal GHE API token remains the `Authorization` bearer token. The backend calls the fixed Graph endpoint `/v1.0/me?$select=id,employeeId`, checks Graph's immutable `id` against the `oid` from the already validated GHE API token, then uses Graph's non-empty `employeeId` to query HIS. Because HIS deployments vary in whether they name this query parameter `employeeCode` or `employeeId`, the backend tries `employeeCode` first and falls back to `employeeId` only when the first lookup returns no record. The HIS response still must contain the exact same `employeeCode`. A missing Graph permission/consent, missing employee ID, or identity mismatch prevents profile creation.
- The same Graph lookup runs on refresh so current Entra employee code drives `SearchEmployees`; HIS must return the same non-empty `employeeCode`. A changed employee code is accepted only when HIS returns that same code, and local uniqueness constraints still prevent attaching an already-owned employee number to another account.
- HIS lookup is optional enrichment: a no-match, incomplete response, or HIS HTTP/network/TLS/timeout failure is logged but does not block authentication after Entra and Graph identity checks succeed. First login creates a minimal local `teamMember` profile linked to the verified Entra issuer/object ID, with no employee number, organization, department, or position. Existing profiles remain unchanged on an optional lookup failure. Later `/api/auth/me` calls retry HIS and populate the profile once a matching record is available. Graph identity mismatches, missing Graph employee identifiers, branch/department mapping failures, and local identity-link conflicts remain blocking errors.
- Graph profile data is never trusted from a browser-supplied employee-code field. The backend sends the Graph access token only to `graph.microsoft.com`, disables redirects, and compares the returned Graph object ID with the signed API-token subject before using the code.
- Zero, multiple, or incomplete results do not update an existing profile; first login falls back to a minimal profile. A HIS employee-code mismatch is a blocking identity error. A local email/employee-code uniqueness conflict is not automatically linked; an administrator must use the existing audited identity-link process.
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
STAFF_BRANCH_ORG_MAP='{"BET":"BET"}'
```

The project seed includes Betsoftware (`BET`) for local development. The deployed database must also have a local `Organization` with short code `BET`; an administrator should create or verify it before enabling sync in that environment. Do not map `BET` to Hollywoodbets (`HB`). For a production HIS endpoint, set `STAFF_API_ENDPOINT` and `STAFF_API_ALLOWED_HOSTS` to its approved HTTPS host and keep redirects disabled. The service refuses non-HTTPS endpoints, hosts outside the allowlist, and requests when `NODE_TLS_REJECT_UNAUTHORIZED=0` is active.

Migrations `0015_his_profile_sync` and `0016_his_termination_date` add nullable fields without changing existing local authorization data. Deploy with `prisma migrate deploy`; do not edit already-applied migrations.

## Expected upstream API contract

The current UAT query parameter contract is `employeeId` for first login and refresh. The API should return HTTP 200, `success: true`, and one record with non-empty `employeeCode`, `fullName`, `departmentName`, `jobTitle`, and `branchName`. `email`, `managerEmployeeCode`, `employmentStatus`, `employmentType`, and `terminationDate` may be null when not applicable. The API may return one object or a one-item `data` array. It should return 404 for no match, 401/403 for invalid service credentials, 429 for throttling, and 5xx for service failure; it should not return an HTTP 200 response with a success-shaped error object.

The sample UAT response with empty `employeeCode`, null email, empty manager code, and department ID `0` is not sufficient to provision an account. The Entra user profile must have `employeeId` populated, and the SPA registration must have Microsoft Graph delegated `User.Read` permission consented so MSAL can acquire a Graph token. `Application.Read.All` is not required for this user profile lookup; `ProfilePhoto.Read.All` is also unrelated. Microsoft Graph documents `employeeId` as a user property returned when selected with `$select`; see [Get a user](https://learn.microsoft.com/en-us/graph/api/user-get?view=graph-rest-1.0) and the [user resource](https://learn.microsoft.com/en-us/graph/api/resources/user?view=graph-rest-1.0). `email`, `preferred_username`, and `upn` remain contact/display hints and are not used for HR identity matching. A missing manager employee code means the app cannot safely populate the manager relation from the manager's display name alone.

## Operational errors

Failure logs contain a request ID, the `staff_profile_sync` stage, and a reason code; they do not include the bearer token, raw response, or user email. Optional HIS lookup failures are logged and `/api/auth/me` can still return the local user. Graph token/permission failures and identity or profile-mapping conflicts can return 403 or 503 depending on whether the cause is an invalid identity/profile or a temporary upstream failure. After login, check `GET /api/auth/me`; it includes HIS status, branch, employment type, termination date, and the last successful sync timestamp.
