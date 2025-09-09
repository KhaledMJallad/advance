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
        advance = frappe.new_doc("Employee Advance")
        advance.employee = employee
        advance.advance_amount = float(str(petty_cash_amount).replace(",", ""))
        advance.exchange_rate = 1
        advance.advance_account = '1620 - Petty-cash - TD'
        advance.company = company
        advance.posting_date = frappe.utils.nowdate()
        advance.purpose = "Request for Initial Petty Cash Float"
        advance.custom_project = project

        advance.insert(ignore_permissions=True)



        project_manager_email = frappe.db.sql(''' 
            SELECT 
                `user_id`
            FROM 
                `tabEmployee`
            WHERE 
                `name` = %s
            AND 
                `status` = 'Active'
        ''', (project_manager, ), as_dict = True)
        if project_manager_email:
            user_id = project_manager_email[0].user_id
            frappe.get_doc({
                "doctype": "ToDo",
                "description": f"Review Advance {advance.name}",
                "reference_type": "Employee Advance",
                "reference_name": advance.name,
                "allocated_to": user_id,   # user to assign
                "status": "Open",
                "priority": "Medium"
            }).insert(ignore_permissions=True)

            frappe.share.add(
                doctype="Employee Advance",
                name=advance.name,
                user=user_id,   # user to share with
                read=1,
                write=1,
                share=1
            )

        frappe.db.set_value("Petty-cash", name, "custom_advance", advance.name)
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
