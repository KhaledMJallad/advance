import frappe
from frappe import _
from hrms.hr.doctype.expense_claim.expense_claim import ExpenseClaim
import json
class CustomExpenseClaim(ExpenseClaim):

    pass        
        


@frappe.whitelist()
def force_to_save(name):
    doc =  frappe.get_doc('Expense Claim', name)
    doc.insert(ignore_permissions=True)
    return {"status": 201, 'message': "data has been saved successfuly"}

#########################################################################
# @frappe.whitelist()
# def share_with_and_assign_to(workflow_state, project_manager, name):
#     response = frappe.db.sql('''
#         SELECT DISTINCT u.email, wft.allowed
#         FROM `tabWorkflow` AS wf
#         LEFT JOIN `tabWorkflow Transition` AS wft
#             ON wf.name = wft.parent
#         LEFT JOIN `tabHas Role` AS hr
#             ON wft.allowed = hr.role
#         LEFT JOIN `tabUser` AS u
#             ON u.name = hr.parent
#         WHERE wft.state = %s
#           AND wf.document_type = 'Expense Claim'
#           AND u.enabled = 1
#     ''', (workflow_state,), as_dict=True)

#     if not response:
#         return {'status': 404, 'message': 'No employee found for this workflow state'}

#     clear_email = []

#     for row in response:
#         if not row['email'] or row['email'] in ['admin@example.com', 'Administrator']:
#             continue

#         if row['allowed'] == 'Projects Manager':
#             project_mgr_user = frappe.db.sql('''
#                 SELECT user_id 
#                 FROM `tabEmployee`
#                 WHERE name = %s AND status = 'Active'
#             ''', (project_manager,), as_dict=True)

#             if project_mgr_user and project_mgr_user[0].get('user_id'):
#                 user_id = project_mgr_user[0]['user_id']
#                 if user_id not in ['admin@example.com', 'Administrator']:
#                     clear_email.append(user_id)
#         else:
#             clear_email.append(row['email'])

#     # ---- ToDo + Share ----
#     status = ['Open', 'Pending']
#     created, skipped = [], []

#     for user_email in clear_email:
#         exists = frappe.db.exists(
#             "ToDo",
#             {
#                 "reference_type": "Expense Claim",
#                 "reference_name": name,
#                 "allocated_to": user_email,
#                 "status": ("in", status)
#             }
#         )

#         if exists:
#             skipped.append(user_email)
#             continue

#         frappe.get_doc({
#             "doctype": "ToDo",
#             "allocated_to": user_email,
#             "reference_type": "Expense Claim",
#             "reference_name": name,
#             "description": f"Please review Expense Claim {name} - State: {workflow_state}",
#             "priority": "High",
#             "status": "Open",
#             "date": frappe.utils.today()
#         }).insert(ignore_permissions=True)

#         # Share with read-only access by default
#         frappe.share.add("Expense Claim", name, user_email, read=1, write=1)

#         created.append(user_email)

#     if created:
#         return {
#             'status': 201,
#             'message': f"Assignments created and shared for: {', '.join(created)}",
#             'skipped': skipped
#         }
#     else:
#         return {
#             'status': 200,
#             'message': "All employees already had assignments",
#             'skipped': skipped
#         }
#########################################################################

######################################################################### Edit
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
          AND wf.document_type = 'Expense Claim'
          AND u.enabled = 1
    ''', (workflow_state,), as_dict=True)

    if not response:
        return {'status': 404, 'message': 'No employee found for this workflow state'}

    clear_email = []

    # جلب معلومات الـ Expense Claim للحصول على الموظف والمالك
    expense_claim = frappe.get_doc("Expense Claim", name)
    employee_user_id = None
    document_owner = expense_claim.owner

    # جلب user_id الخاص بالموظف المسجل في الـ Expense Claim
    if expense_claim.employee:
        employee_data = frappe.db.sql('''
            SELECT user_id 
            FROM `tabEmployee`
            WHERE name = %s AND status = 'Active'
        ''', (expense_claim.employee,), as_dict=True)
        
        if employee_data and employee_data[0].get('user_id'):
            employee_user_id = employee_data[0]['user_id']

    for row in response:
        if not row['email'] or row['email'] in ['admin@example.com', 'Administrator']:
            continue

        # معالجة خاصة للـ Role "Employee"
        if row['allowed'] == 'Employee':
            # إضافة الموظف نفسه فقط (إذا كان موجود ومفعل)
            if employee_user_id and employee_user_id not in ['admin@example.com', 'Administrator']:
                clear_email.append(employee_user_id)
            
            # إضافة مالك المستند
            if document_owner and document_owner not in ['admin@example.com', 'Administrator']:
                clear_email.append(document_owner)
        
        elif row['allowed'] == 'Projects Manager':
            project_mgr_user = frappe.db.sql('''
                SELECT user_id 
                FROM `tabEmployee`
                WHERE name = %s AND status = 'Active'
            ''', (project_manager,), as_dict=True)

            if project_mgr_user and project_mgr_user[0].get('user_id'):
                user_id = project_mgr_user[0]['user_id']
                if user_id not in ['admin@example.com', 'Administrator']:
                    clear_email.append(user_id)
        else:
            # للأدوار الأخرى، إضافة جميع المستخدمين كما هو معتاد
            clear_email.append(row['email'])

    # إزالة التكرارات
    clear_email = list(set(clear_email))

    # ---- ToDo + Share ----
    status = ['Open', 'Pending']
    created, skipped = [], []

    for user_email in clear_email:
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

        frappe.get_doc({
            "doctype": "ToDo",
            "allocated_to": user_email,
            "reference_type": "Expense Claim",
            "reference_name": name,
            "description": f"Please review Expense Claim {name} - State: {workflow_state}",
            "priority": "High",
            "status": "Open",
            "date": frappe.utils.today()
        }).insert(ignore_permissions=True)

        # Share with read-only access by default
        frappe.share.add("Expense Claim", name, user_email, read=1, write=1)

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
#########################################################################

@frappe.whitelist()
def change_to_lission_officer(name, liaison_officer):
    frappe.db.set_value("Expense Claim", name, "employee", liaison_officer, update_modified=True)
    frappe.db.commit()
    return {'status': 201, 'message': 'successfuly updated'}

@frappe.whitelist()
def change_employee_to_on_bahalf(name, on_behalf):
    frappe.db.set_value("Expense Claim", name, "employee", on_behalf, update_modified=True)
    frappe.db.commit()
    return {'status': 201, 'message': 'successfuly updated'}


@frappe.whitelist()
def change_doc_type_status(name):
    doc = frappe.get_doc("Expense Claim", name)
    doc.docstatus = 1   
    doc.save()

@frappe.whitelist()
def image_show(expenses, name):
    # Collect file URLs from expenses
    arr = json.loads(expenses)
    file_urls = [row["invoice_image"] for row in arr]
    if not file_urls:
        return {'status': 400, 'message': 'No files found'}

    response = frappe.db.sql(''' 
        SELECT name, file_url, is_private
        FROM `tabFile`
        WHERE file_url IN %(file_urls)s
    ''', {"file_urls": tuple(file_urls)}, as_dict=True)

    
    existing_files = frappe.get_all(
        "File",
        filters={
            "attached_to_doctype": "Expense Claim",   
            "attached_to_name": name,
            "file_url": ["in", file_urls]
        },
        pluck="file_url"
    )
    for row in response:
        if row["file_url"] not in existing_files:
            frappe.get_doc({
                "doctype": "File",
                "file_url": row["file_url"],
                "is_private": row["is_private"],
                "attached_to_doctype": "Expense Claim",   # 🔹 Or pass as param
                "attached_to_name": name
            }).insert(ignore_permissions=True)
        else:
            return {'status': 404, 'messgae': 'not file has been founc'}

    return {'status': 201, 'message': 'Files have been shared successfully'}

@frappe.whitelist()
def create_advance(name ,employee, petty_cash_amount, project, company, petty_cash):
    try:
        advance = frappe.new_doc("Employee Advance")
        advance.employee = employee
        advance.advance_amount = float(str(petty_cash_amount).replace(",", ""))
        advance.exchange_rate = 1
        advance.advance_account = '1620 - Petty Cash - iKSA'
        advance.company = company
        advance.posting_date = frappe.utils.nowdate()
        advance.purpose = "Project petty-cash Request"
        advance.custom_project = project

        advance.insert(ignore_permissions=True)
        advance.submit()

        frappe.db.set_value("Expense Claim", name, "custom_advance", advance.name)
        frappe.db.set_value("Petty-cash", petty_cash, "custom_advance", advance.name)
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
    updated = 0

    for row in arr:
        if row.get('expense_food_name'):
            frappe.db.set_value(
                "Food Expenses",
                row['expense_food_name'],
                "expense_claim",
                name,
                update_modified=True
            )
            frappe.db.set_value(
                "Food Expenses",
                row['expense_food_name'],
                'workflow_state',
                'paid',
                update_modified=True
            )
            updated += 1

    if updated > 0:
        frappe.db.commit()  # optional, only if you want to force commit
        return {'status': 201, 'message': f'Successfully updated {updated} record(s)'}
    else:
        return {'status': 404, 'message': 'No matching records found'}
        
        
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
            `project_manager`,
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
            `name`,
            `start_date`,
            `end_date`
        FROM 
            `tabFood Expenses`
        WHERE
            `project` = %s
        AND 
            `project` IS NOT NULL
        AND 
            `expense_claim` IS NULL
        AND 
            `docstatus` = 1
    ''', (project), as_dict = True)

    if not response:
        return {'status': 404, 'message': f"There are no food entries recorded."}
    else:
        return {'status': 200, 'data': response}



@frappe.whitelist()
def update_petty_cash(name, petty_cash):
    frappe.db.set_value("Petty-cash", petty_cash, "custom_expense_claim", name, update_modified=True)
    frappe.db.commit()
    return {'status': 201, 'message':"petty cash has been updated successfuly"}




