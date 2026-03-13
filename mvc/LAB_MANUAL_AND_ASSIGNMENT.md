# Undergraduate Web Development Lab Manual + Assignment
## Project: Online Food Ordering System

## Lab Context
You will design and implement an **Online Food Ordering System** by following MVC and REST best practices in 4 phases.

---

## Learning Objectives
By the end of this lab, students will be able to:
1. Build models and scaffold CRUD views using an MVC framework.
2. Upgrade generated UI with Bootstrap responsive components.
3. Apply correct HTTP methods and REST principles.
4. Design clear, resource-oriented URIs with hierarchy.

---

## Allowed Frameworks (Choose One)
- Laravel (PHP)
- Django (Python)
- ASP.NET Core MVC (C#)

> You must pick **one** framework and complete all phases in that ecosystem.

---

## Suggested Domain Models
At minimum, implement:
- `MenuItem`
- `Order`

### Minimum Fields
- `MenuItem`: id, name, description, price, imageUrl, isAvailable
- `Order`: id, customerName, customerPhone, status, totalAmount, createdAt

You may add relations (example: an order contains many menu items) if your framework setup allows it.

---

## Phase 1: Models & View Generators (Scaffolding)
### Task Requirements
1. Create `MenuItem` and `Order` models.
2. Use your framework's generator/scaffolder to auto-create plain HTML CRUD pages:
   - Create
   - Read (List + Details)
   - Update
   - Delete
3. Ensure database migrations are applied.

### Deliverables for Phase 1
- Source code for both models.
- Generated CRUD controllers/views.
- Screenshots of generated plain HTML pages.

### Instructor Note
The purpose is to observe **framework productivity tools** before manual UI enhancement.

---

## Phase 2: Bootstrap Integration
### Task Requirements
Upgrade the scaffolded plain HTML UI with Bootstrap:
1. Add a responsive **Navbar** with links to:
   - Menu Items
   - Orders
   - Create Menu Item
   - Create Order
2. Use Bootstrap **12-column grid system** on listing pages.
3. Display menu items using Bootstrap **Cards**.
4. Style all forms/buttons using Bootstrap form controls and button classes.
5. Ensure responsive behavior on small and large screens.

### Minimum UI Checklist
- [ ] Navbar visible on all pages.
- [ ] Menu listing uses card-based layout.
- [ ] At least one page uses `row` + `col-*` grid layout correctly.
- [ ] Create/Edit forms have Bootstrap styling.

### Deliverables for Phase 2
- Updated views/templates.
- Before/After screenshots (plain scaffold vs Bootstrap-enhanced).

---

## Phase 3: REST Principles & Method Selection
### Task Requirements
Map each UI action to correct HTTP methods:
- `GET` for reading resources.
- `POST` for creating resources.
- `PUT` (or `PATCH`) for updating resources.
- `DELETE` for deleting resources.

### Required Documentation Section (in your report)
Create a section titled **"REST Compliance Report"** and explain:
1. **Statelessness**:
   - How each request is self-contained.
   - How authentication information is sent (e.g., bearer token in headers).
2. **Idempotency**:
   - Identify which of your endpoints are idempotent.
   - Explain why (e.g., repeating `PUT /menu-items/5` results in same state).

### Example Idempotency Discussion
- Idempotent: `GET /menu-items`, `PUT /menu-items/:id`, `DELETE /menu-items/:id`
- Not necessarily idempotent: `POST /orders`

### Deliverables for Phase 3
- API method mapping table.
- REST Compliance Report section in PDF/Markdown.

---

## Phase 4: Resource & URI Design
### Task Requirements
Submit a list of your API endpoints following strict rules:
1. Use **plural nouns** only.
2. Do **not** use verbs in URI paths.
3. Show **hierarchical** resources where relevant.

### Good Examples
- `/menu-items`
- `/orders`
- `/customers/5/orders`
- `/orders/12/items`

### Bad Examples (Not Allowed)
- `/getMenuItems`
- `/createOrder`
- `/order/delete/5`

### Deliverables for Phase 4
- Endpoint list (with method + URI + purpose).
- At least 1 hierarchical endpoint.

---

## Mandatory Final Submission
1. **Source Code** (zipped repository)
2. **Lab Report** (PDF/Markdown) containing:
   - Framework chosen and setup steps
   - Phase-wise implementation notes
   - REST Compliance Report
   - Endpoint catalog
3. **Screenshots**:
   - Scaffolded plain HTML pages
   - Bootstrap-enhanced pages
4. **Demo Video (3–5 min)** showing CRUD and responsive UI

---

## Assignment Rubric (100 Marks)
- Phase 1: Models + Scaffolding (25)
- Phase 2: Bootstrap UI + Responsiveness (25)
- Phase 3: REST Methods + Statelessness + Idempotency (25)
- Phase 4: Resource URI Design + Hierarchy (15)
- Code Quality + Report Clarity (10)

---

## Step-by-Step Student Workflow (Quick Guide)
1. Create project in chosen MVC framework.
2. Configure database and run initial migration.
3. Create `MenuItem` and `Order` models.
4. Scaffold CRUD views/controllers for both models.
5. Run and verify basic CRUD with plain HTML.
6. Add Bootstrap and redesign templates.
7. Build API endpoints for resources.
8. Validate HTTP method usage.
9. Write REST Compliance Report.
10. Submit endpoint catalog and final package.

---

## Suggested Endpoint Set (Reference)
- `GET /menu-items`
- `GET /menu-items/{id}`
- `POST /menu-items`
- `PUT /menu-items/{id}`
- `DELETE /menu-items/{id}`
- `GET /orders`
- `GET /orders/{id}`
- `POST /orders`
- `PUT /orders/{id}`
- `DELETE /orders/{id}`
- `GET /customers/{id}/orders`

---

## Integrity Rules
- No copied code without citation.
- Keep commit history or progress evidence.
- Every team member must be able to explain full flow.

---

## Instructor Validation Checklist
- [ ] MVC framework used correctly
- [ ] Two required models implemented
- [ ] Auto-scaffolded CRUD generated
- [ ] Bootstrap grid/cards/navbar used
- [ ] Correct HTTP method mapping documented
- [ ] Statelessness + idempotency explained with own endpoints
- [ ] URI rules followed (plural nouns, no verbs, hierarchy shown)
