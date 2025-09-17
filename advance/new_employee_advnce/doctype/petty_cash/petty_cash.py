# Copyright (c) 2025, Khaled Jallad and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class Pettycash(Document):
	pass




@frappe.whitelist()
def get_lision_officer(project):

	response = frappe.db.sql(''' 
		SELECT 
			`custom_liaison_officer`,
			`custom_pettycash_amount`,
            `project_manager`
		FROM
			`tabProject`
		WHERE 
			`name` = %s
		AND 
			`status` = 'Open'
	 ''', (project, ), as_dict=True)
	
	if not response:
		return{'status': 404, 'message': "The project does not exist, or it has been closed or completed. Please contact your administrator to resolve this issue."}
	else:
		return{'status':200, 'data': response}
	
@frappe.whitelist()
def create_new_advance(name, petty_cash_amount, employee, project, company, project_manager):
    try:
        # Create Employee Advance
        advance = frappe.new_doc("Employee Advance")
        advance.employee = employee
        advance.advance_amount = float(str(petty_cash_amount).replace(",", ""))
        advance.exchange_rate = 1
        advance.advance_account = '1620 - Petty Cash - iKSA'
        advance.company = company
        advance.posting_date = frappe.utils.nowdate()
        advance.purpose = "Request for Initial Petty Cash Float"
        advance.custom_project = project
        advance.insert(ignore_permissions=True)
        
        # Link the advance to the petty cash record
        frappe.db.set_value("Petty-cash", name, "custom_advance", advance.name)
        frappe.db.commit()
        
        # Initialize email list
        clear_email = []
        
        # Get employee user ID
        if employee:
            employee_user = frappe.db.sql('''
                SELECT user_id
                FROM `tabEmployee`
                WHERE name = %s AND status = 'Active'
            ''', (employee,), as_dict=True)
            
            if employee_user and employee_user[0].get('user_id'):
                user_id = employee_user[0]['user_id']
                if user_id not in ['admin@example.com', 'Administrator']:
                    clear_email.append(user_id)
        else:
            return {'status': 400, 'message': 'Employee parameter is required'}
        
        # Check if we have any valid users
        if not clear_email:
            return {'status': 404, 'message': 'No valid users found for assignment'}
        
        # Create ToDo tasks and share documents
        status = ['Open', 'Pending']
        created, skipped = [], []
        
        for user_email in clear_email:
            # Check if ToDo already exists
            exists = frappe.db.exists(
                "ToDo",
                {
                    "reference_type": "Employee Advance",
                    "reference_name": advance.name,  # Fixed: use advance.name instead of name
                    "allocated_to": user_email,
                    "status": ("in", status)
                }
            )
            
            if exists:
                skipped.append(user_email)
                continue
            
            # Create new ToDo
            frappe.get_doc({
                "doctype": "ToDo",
                "allocated_to": user_email,
                "reference_type": "Employee Advance",
                "reference_name": advance.name,  # Fixed: use advance.name instead of name
                "description": f"Please review Employee Advance {advance.name} - Purpose: Request for Initial Petty Cash Float",  # Fixed description
                "priority": "High",
                "status": "Open",
                "date": frappe.utils.today()
            }).insert(ignore_permissions=True)
            
            # Share the Employee Advance document
            frappe.share.add("Employee Advance", advance.name, user_email, read=1, write=1, share=1)  # Fixed: use advance.name
            created.append(user_email)
        
        # Return success response
        if created:
            return {
                "status": 201, 
                "advance": advance.name,
                "message": f"Employee Advance created and assigned to: {', '.join(created)}",
                "skipped": skipped if skipped else []
            }
        else:
            return {
                "status": 200, 
                "advance": advance.name,
                "message": "Employee Advance created but all users already had assignments",
                "skipped": skipped
            }
            
    except Exception as e:
        error_msg = str(e)
        
        # Handle specific error types
        if isinstance(e, frappe.ValidationError):
            return {"status": 400, "error": "Validation error", "message": error_msg}
        elif isinstance(e, frappe.DuplicateEntryError):
            return {"status": 409, "error": "Duplicate entry", "message": error_msg}
        else:
            frappe.log_error(frappe.get_traceback(), "Employee Advance Creation Failed")
            return {"status": 500, "error": "Server error", "message": error_msg}

@frappe.whitelist()
def fetch_requested_and_end_peety_cash(project):
    petty_cash_request = frappe.db.sql('''
        SELECT 
            count(*) AS `requested`
        FROM 
            `tabPetty-cash` 
        WHERE
            `project` = %s
        AND 
            `petty_cash_type` = 'Initial Petty cash Float'
        AND 
            `docstatus` = 1
     ''', (project, ), as_dict = True)
    
    petty_cash_end = frappe.db.sql('''
        SELECT 
            count(*) AS `end`
        FROM 
            `tabPetty-cash` 
        WHERE
            `project` = %s
        AND 
            `petty_cash_type` = 'Petty-cash Project End'
        AND 
            `docstatus` = 1
     ''', (project, ), as_dict = True)
    
	
    return {'status': 200, 'petty_cash_request': petty_cash_request, "petty_cash_end": petty_cash_end}
