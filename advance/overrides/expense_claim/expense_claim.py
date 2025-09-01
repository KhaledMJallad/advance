import frappe
from frappe import _
from hrms.hr.doctype.expense_claim.expense_claim import ExpenseClaim
import json
class CustomExpenseClaim(ExpenseClaim):

    pass        
        


@frappe.whitelist()
def share_with_and_assign_to(workflow_state, project_manager, name):
    response = frappe.db.sql('''
        SELECT DISTINCT u.email, wft.allowed
        FROM `tabWorkflow` AS wf
        LEFT JOIN `tabWorkflow Transition` AS wft
            ON wf.name = wft.parent
        LEFT JOIN `tabHas Role` AS hr
            ON wft.allowed = hr.role
        LEFT JOIN `tabUser` AS u
            ON u.name = hr.parent
        WHERE wft.state = %s
          AND u.enabled = 1
    ''', (workflow_state,), as_dict=True)

    if not response:
        return {'status': 404, 'message': 'No Employee has been found'}

    clear_email = []

    for row in response:
        # ❌ Skip admin
        if row['email'] == 'admin@example.com':
            continue

        if row['allowed'] == 'Projects Manager':
            project_mgr_user = frappe.db.sql('''
                SELECT user_id 
                FROM `tabEmployee`
                WHERE name = %s AND status = 'Active'
            ''', (project_manager,), as_dict=True)

            if project_mgr_user and project_mgr_user[0].get('user_id') and project_mgr_user[0]['user_id'] != 'admin@example.com':
                clear_email.append({'email': project_mgr_user[0]['user_id']})
        else:
            clear_email.append({'email': row['email']})

    # ---- Create ToDo and Share ----
    status = ['Open', 'Pending']
    created, skipped = [], []

    for row in clear_email:
        user_email = row['email']

        exists = frappe.db.exists(
            "ToDo",
            {
                "reference_type": "Expense Claim",
                "reference_name": name,
                "allocated_to": user_email,
                "status": ("in", status)
            }
        )

        if exists:
            skipped.append(user_email)
            continue

        # Create ToDo
        todo_doc = frappe.get_doc({
            "doctype": "ToDo",
            "allocated_to": user_email,
            "reference_type": "Expense Claim",
            "reference_name": name,
            "description": f"Please review Expense Claim {name} - State: {workflow_state}",
            "priority": "High",
            "status": "Open",
            "date": frappe.utils.today()
        })
        todo_doc.insert(ignore_permissions=True)

        # Share the document with the user
        frappe.share.add("Expense Claim", name, user_email, read=1, write=0)

        created.append(user_email)

    if created:
        return {
            'status': 201,
            'message': f"Assignments created and shared for: {', '.join(created)}",
            'skipped': skipped
        }
    else:
        return {
            'status': 200,
            'message': "All employees already had assignments",
            'skipped': skipped
        }



@frappe.whitelist()
def change_employee_to_on_bahalf(name, on_behalf):
    frappe.db.set_value("Food Expenses", on_behalf, "employee", name, update_modified=True)
    frappe.db.commit()
    return {'status': 201, 'message': 'successfuly updated'}


@frappe.whitelist()
def change_doc_type_status(name):
    doc = frappe.get_doc("Expense Claim", name)
    doc.docstatus = 1   
    doc.save()

@frappe.whitelist()
def image_show(expenses, name):
    arr = json.loads(expenses)
    urls = [row["invoice_image"] for row in arr]
    response = frappe.db.sql(''' 
        SELECT fn.name
        FROM `tabFile` AS fn
        LEFT JOIN `tabFile` AS furl
            ON fn.file_url = furl.file_url  
        WHERE furl.file_url IN %s
    ''', (urls,), as_dict=True)
    if response:
        for row in response:
            file_name = row["name"]
            old_file = frappe.get_doc("File", file_name)

            exists = frappe.db.exists(
                "File",
                {
                    "file_url": old_file.file_url,
                    "attached_to_doctype": "Expense Claim",
                    "attached_to_name": name # use self.name here
                }
            )

            frappe.get_doc({
                    "doctype": "File",
                    "file_url": old_file.file_url,
                    "is_private": old_file.is_private,
                    "attached_to_doctype": 'Expense Claim',
                    "attached_to_name": name
            }).insert(ignore_permissions=True)

        return {'status':201, 'message': 'Files has been shared successfuly'}


@frappe.whitelist()
def create_advance(name ,employee, petty_cash_amount, project, company):
    try:
        advance = frappe.new_doc("Employee Advance")
        advance.employee = employee
        advance.advance_amount = float(str(petty_cash_amount).replace(",", ""))
        advance.exchange_rate = 1
        advance.advance_account = '1610 - Employee Advances - TD'
        advance.company = company
        advance.currency = 'JOD'
        advance.posting_date = frappe.utils.nowdate()
        advance.purpose = "Project petty-cash Request"
        advance.custom_project = project

        advance.insert(ignore_permissions=True)
        advance.submit()

        # link to Expense Claim
        frappe.db.set_value("Expense Claim", name, "custom_advance", advance.name)
        frappe.db.commit()

        return {"status": 201, "advance": advance.name}

    except Exception as e:
        error_msg = str(e)

        # check the type using if-statements
        if isinstance(e, frappe.ValidationError):
            return {"status": 400, "error": "Validation error", "message": error_msg}
        elif isinstance(e, frappe.DuplicateEntryError):
            return {"status": 409, "error": "Duplicate entry", "message": error_msg}
        else:
            frappe.log_error(frappe.get_traceback(), "Advance Creation Failed")
            return {"status": 500, "error": "Server error", "message": error_msg}


@frappe.whitelist()
def update_food(expenses, name):
    arr = json.loads(expenses)
    for row in arr:
        if row.get('expense_food_name'):
            food_name_arr = [f.strip() for f in row.get('expense_food_name').split(',')]
            for food in food_name_arr:
                    frappe.db.set_value("Food Expenses", food, "expense_claim", name, update_modified=True)
                    frappe.db.commit()
            return {'status': 201, 'message': 'successfuly updated'}
        
        
@frappe.whitelist()
def get_employee_advance(project, employee):
    is_lisseon_officer = frappe.db.sql('''
    SELECT `custom_liaison_officer`
    FROM `tabProject`
    WHERE 
    `name` = %s
    AND 
    `custom_liaison_officer` = %s
    AND 
    `status` = 'Open'
    
    ''', (project, employee, ), as_dict=True)
    
    if is_lisseon_officer:
        response = frappe.db.sql(''' 
        SELECT 
        `advance_amount`,
        `name`,
        `posting_date`
        FROM `tabEmployee Advance`
        WHERE 
        `custom_project` = %s
        AND 
        `employee` = %s
        AND status = 'Paid'
        ''', (project, employee, ), as_dict=True)
        
        if not response:
            return {'status':404 , 'message':'No data was found'}
        else:
            return {'status':200 , 'data':response}
    else:
        return {'status':404 , 'message':'No data was found'}

@frappe.whitelist()
def get_project_data_expense(project):
    response = frappe.db.sql("""
        SELECT 
            `name`,
            `project_name`,
            `expected_start_date`,
            `expected_end_date`,
            `custom_liaison_officer`,
            `custom_project_manager`,
            `custom_pettycash_amount`,
            `custom_on_behalf`
        FROM `tabProject`
        WHERE 
            `name` = %s
            AND `status` = 'Open'
    """, (project,), as_dict=True)

    if not response:
        return {
            'status': 404,
            'message': ("This project has either been completed or has not yet been declared. "
                        "Please contact the administrator to resolve this issue.")
        }
    else:
        return {'status': 200, 'data': response}
        
@frappe.whitelist()
def get_project_manager_email(epmloyee):
    response = frappe.db.sql("""
        SELECT 
            `user_id`
        FROM `tabEmployee`
        WHERE 
            `name` = %s
            AND `status` = 'Active'
    """, (epmloyee,), as_dict=True)

    if not response:
        return {
            'status': 404,
            'message': ("This project has either been completed or has not yet been declared. "
                        "Please contact the administrator to resolve this issue.")
        }
    else:
        return {'status': 200, 'data': response}


@frappe.whitelist()
def get_advances_without_project(employee):
    response = frappe.db.sql("""
        SELECT 
            `advance_amount`,
            `name`,
            `posting_date`
        FROM `tabEmployee Advance`
        WHERE 
            `employee` = %s
            AND 
                `status` = 'Paid'
            AND 
                `custom_project` IS NULL 
        ORDER BY `posting_date` DESC
    """, (employee,), as_dict=True)
    
    if not response:
        return {
            'status': 404,
            'message': "No paid advances without a linked project were found for this employee."
        }
    else:
        return {'status': 200, 'data': response}
    

@frappe.whitelist()
def fetch_food(project, employee):
    response = frappe.db.sql(''' 
        SELECT 
            `total_sanctioned_amount`,
            `name`
        FROM 
            `tabFood Expenses`
        WHERE
            `project` = %s
        AND 
            `project` IS NOT NULL
        AND 
            `employee` = %s
        AND 
            `expense_claim` IS NULL
    ''', (project, employee), as_dict = True)

    if not response:
        return {'status': 404, 'message': f"There are no food entries recorded."}
    else:
        return {'status': 200, 'data': response}


@frappe.whitelist()
def fetch_petty_cahs_request_and_end(project):
    petty_cash_request = frappe.db.sql('''
        SELECT 
            count(*) AS `requested`
        FROM 
            `tabExpense Claim` 
        WHERE
            `project` = %s
        AND 
            `custom_espense_type` = 'Project petty-cash Request'
     ''', (project, ), as_dict = True)
    
    petty_cash_end = frappe.db.sql('''
        SELECT 
            count(*) AS `end`
        FROM 
            `tabExpense Claim` 
        WHERE
            `project` = %s
        AND 
            `custom_espense_type` = 'Project petty-cash End'
        AND
            `docstatus` = 1
     ''', (project, ), as_dict = True)
    

    return {'status': 200, 'petty_cash_request': petty_cash_request, "petty_cash_end": petty_cash_end}


