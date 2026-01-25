import frappe
from frappe import _
from hrms.hr.doctype.employee_advance.employee_advance import EmployeeAdvance


# class CustomEmployeeAdvance(EmployeeAdvance):

@frappe.whitelist()
def change_status(name):
    frappe.db.set_value("Employee Advance", name, "workflow_state", 'Cancel', update_modified=True)
    return {'status': 201, 'message': 'updated successfuly'}



@frappe.whitelist()
def change_workflow_status(name):
    doc = frappe.get_doc('Employee Advance', name)
    status = doc.status

    if status == "Paid":
        status = "paid"
    
    frappe.db.set_value("Employee Advance", name, "workflow_state", status, update_modified=True)
    return {'status': 201, 'message': 'updated successfuly'}

@frappe.whitelist()
def get_lisson_officer(employee):
    response = frappe.db.sql(''' SELECT 
                            `name` 
                            FROM `tabProject` WHERE
                            `custom_liaison_officer` = %s
                            AND `status` = 'Open'
                            ''', (employee, ), as_dict=True)

    if not response:
        return {'status':404 , 'message':'No data was found'}
    else:
        return {'status':200 , 'data':response}



@frappe.whitelist()
def get_project_data_main(project):
     response = frappe.db.sql('''
                        SELECT 
                        `name`,
                        `project_name`,
                        `expected_start_date`,
                        `expected_end_date`,
                        `custom_liaison_officer`,
                        `custom_pettycash_amount`
                        FROM `tabProject`
                        WHERE 
                        `name` = %s
                        AND `status` = 'Open'
         ''', (project, ), as_dict=True) 
     if response:
         return {'status': 200, 'data': response}
     else:
         return {'status': 404, 'message': 'No data has been found'}    

   
@frappe.whitelist()
def get_project_data(project, employee):
    response = frappe.db.sql('''
                        SELECT 
                        `name`,
                        `project_name`,
                        `expected_start_date`,
                        `expected_end_date`,
                        `custom_liaison_officer`,
                        `custom_pettycash_amount`
                        FROM `tabProject`
                        WHERE 
                        `name` = %s
                        AND `status` = 'Open'
         ''', (project, ), as_dict=True) 
    
    project_data = response[0]  # Should only be one record
    petty_cash_amount = float(project_data.get('custom_pettycash_amount', 0))   
    
    advance = frappe.db.sql(''' 
        SELECT `claimed_amount`, 
        `advance_amount`
        FROM `tabEmployee Advance`
        WHERE `custom_project` = %s
        AND `employee` = %s
        AND `status` =  'Paid' 
    ''', (project, employee, ), as_dict=True)
    
    total_used = 0
    remaining_amount = 0
    if advance:
        for item in advance:
            advance_amt = float(item['advance_amount'] or 0)
            claimed_amt = float(item['claimed_amount'] or 0)
            if claimed_amt > 0:
                total_used += claimed_amt
            else:
                total_used += advance_amt

    

    remaining_amount = abs(petty_cash_amount - total_used)
    if not response:
        return {'status': 404, 'message': "This project has either been completed or has not yet been declared. Please contact the administrator to resolve this issue."}
    else:
        return {'status': 200, 'data': remaining_amount}
    
@frappe.whitelist()
def get_employee_number(user):
    response = frappe.db.sql('''
    SELECT 
        `name`
    FROM 
        `tabEmployee`
    WHERE 
        `user_id` = %s
    AND 
        `status` = 'Active'
    ''', (user, ), as_dict=True)

    if not response:
        frappe.response["message"] = {'status':404 , 'message':'No data was found'}
    else:
        frappe.response["message"] = {'status':200 , 'data':response}


@frappe.whitelist()
def share_with_and_assign_to(workflow_state, name, project_manager):
    
    clear_email = []
    if workflow_state == 'Project Manager':
    
        if project_manager:
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
            return {'status': 400, 'message': 'Project manager parameter is required for Project Manager workflow state'}
        
    # Check if we have any emails to process
    if not clear_email:
        return {'status': 404, 'message': 'No valid users found for assignment'}

    # ---- ToDo + Share ----
    status = ['Open', 'Pending']
    created, skipped = [], []

    for user_email in clear_email:
        exists = frappe.db.exists(
            "ToDo",
            {
                "reference_type": "Employee Advance",
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
            "reference_type": "Employee Advance",
            "reference_name": name,
            "description": f"Please review Employee Advance {name} - State: {workflow_state}",
            "priority": "High",
            "status": "Open",
            "date": frappe.utils.today()
        }).insert(ignore_permissions=True)

        # Share with read-only access by default
        frappe.share.add("Employee Advance", name, user_email, read=1, write=1, share=1)

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
def update_petty_cash_status(name):
    if not name :
        return {'status': 400, 'message':"Name is not exiest"}
    
    employee_advance_name = frappe.db.exists('Employee Advance', name)

    if not employee_advance_name:
        return {'status': 404, 'message': "Nmae is not Exist"}
    
    petty_cahs_name =  frappe.db.sql('''
        SELECT 
            `name`
        FROM
            `tabPetty-cash`
        WHERE
            `custom_advance` = %s
        AND
            `docstatus` = 1
        AND 
            `petty_cash_type` = 'Initial Petty cash Float'
    ''', (employee_advance_name, ), as_dict = True)

    petty_cash = [item['name'] for item in petty_cahs_name]
    
    if not petty_cash[0]:
        return {'status': 404, 'message': "No data was found"}
    
    frappe.db.set_value('Petty-cash', petty_cash[0], 'docstatus', 2)
    frappe.db.commit()
    return {'status': 201 , 'message': "Status has been updated successfully"}