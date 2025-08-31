# Copyright (c) 2025, Khaled Jallad and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class FoodExpenses(Document):
	def validate(self):
		file_url = [row.invoice_image for row in self.expenses if row.invoice_image]
		
		response = frappe.db.sql(''' 
        SELECT fn.name
        FROM `tabFile` AS fn
        LEFT JOIN `tabFile` AS furl
        ON fn.file_url = furl.file_url  
        WHERE furl.file_url IN %s
    ''', (file_url,), as_dict=True)
		if response:
			for row in response:
				file_name = row["name"]
				old_file = frappe.get_doc("File", file_name)
				exists = frappe.db.exists(
                "File",
                {
                    "file_url": old_file.file_url,
                    "attached_to_doctype": "Food Expenses",
                    "attached_to_name": self.name   # استخدم self.name بدل row["name"]
                }
            )
				if not exists: 
					frappe.get_doc({
                    "doctype": "File",
                    "file_url": old_file.file_url,
                    "is_private": old_file.is_private,
                    "attached_to_doctype": self.doctype,
                    "attached_to_name": self.name
                }).insert(ignore_permissions=True)


        		


	
	
@frappe.whitelist()
def get_employee_number(user): 
    response = frappe.db.sql('''
        SELECT `name`
            FROM `tabEmployee`
            WHERE
            `user_id` = %s
            AND `status` = 'Active'
        ''', (user, ), as_dict=True)
        
    if not response:
        return {'status': 404, 'message': "The user account you are logged in with does not exist or is not currently active. Please contact your system administrator to resolve this issue."}
    else:
        return {'status': 200, 'data': response}


@frappe.whitelist()
def get_project_data(project_name):
    response = frappe.db.sql(''' 
        SELECT 
            `expected_start_date`,
            `expected_end_date`,
            `custom_liaison_officer`,
			`project_manager`
        FROM `tabProject`
        WHERE `name` = %s
        AND `status` = 'Open'
    ''', (project_name,), as_dict=True)

    if not response:
        return {
            'status': 404,
            'message': (
                "You cannot select this project because it has been completed, "
                "closed, or does not exist. Please contact your system administrator "
                "to resolve this issue."
            )
        }
    else:
        return {
            'status': 200,
            'data': response
        }



@frappe.whitelist()
def get_expenses_food(project ,start_date, end_date):
	response = frappe.db.sql(''' 
	SELECT `name`
	FROM `tabFood Expenses`
	WHERE `project` = %s 
	AND `start_date` >= %s 
	AND `end_date` <= %s
	''', (project, start_date, end_date), as_dict=True)
      
	if not response:
		return {'status':404, 'message': 'no data was found'}
	else:
		return {'status':200, 'data': response}


@frappe.whitelist()
def is_partner(employee):
	response = frappe.db.sql('''
	SELECT `name`
	FROM `tabEmployee`
	WHERE `name` = %s AND `designation` = 'Partner' AND `status` = 'Active'
	 ''', (employee,), as_dict=True)
	
	if not response:
		return {'status': 404, 'message': 'no data was found'}
	else:
		return {'status' : 200, 'data' : response}
	


@frappe.whitelist()
def employeeHasAttendToday(employee, date):
	start_time = f"{date} 00:00:00"
	end_time   = f"{date} 23:59:59"
	response = frappe.db.sql('''
		SELECT `name`
		FROM `tabEmployee Checkin`
		WHERE `employee` = %s
		AND `work_mode` = 'Onsite'
		AND `time` >= %s
		AND `time` <= %s
	 ''', (employee, start_time, end_time, ), as_dict=True)
	
	if not response:
		return {'status': 404, 'message': 'no data was found'}
	else: 
		return {'status' : 200, 'data' : response}


@frappe.whitelist()
def getEmployeeAllWeekAttendance(employee, week_start_date, week_end_date):
	start_date = f"{week_start_date} 00:00:00"
	end_date = f"{week_end_date} 23:59:59"

	response = frappe.db.sql('''
		SELECT `name`
		FROM `tabEmployee Checkin`
		WHERE `employee` = %s
		AND `work_mode` = 'Onsite'
		AND `time` >= %s
		AND `time` <= %s
	 ''', (employee, start_date, end_date, ), as_dict=True)
	
	if not response:
		return {'status': 404, 'message': 'no data was found'}
	else: 
		return {'status' : 200, 'data' : response}
	

@frappe.whitelist()
def assign_food_expenses(workflow_state, project_manager, name):
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

    print('response_email:', response)

    if not response:
        return {'status': 404, 'message': 'No Employee has been found'}

    clear_email = []

    for row in response:
        # ❌ Skip admin
        if row['email'] == 'admin@example.com':
            continue

        # ❌ Skip Project Manager role → instead use the one you pass in
        if row['allowed'] == 'Project Manager':
            project_mgr_user = frappe.db.sql('''
                SELECT user_id 
                FROM `tabEmployee`
                WHERE name = %s AND status = 'Active'
            ''', (project_manager,), as_dict=True)

            if project_mgr_user and project_mgr_user[0]['user_id'] != 'admin@example.com':
                clear_email.append({'email': project_mgr_user[0]['user_id']})
        else:
            clear_email.append(row)

    # ---- Create ToDo and Share ----
    status = ['Open', 'Pending']
    created, skipped = [], []

    for row in clear_email:
        exists = frappe.db.exists(
            "ToDo",
            {
                "reference_type": "Food Expenses",
                "reference_name": name,
                "allocated_to": row['email'],
                "status": ("in", status)
            }
        )

        if exists:
            skipped.append(row['email'])
            continue

        # Create ToDo
        todo_doc = frappe.get_doc({
            "doctype": "ToDo",
            "allocated_to": row['email'],
            "reference_type": "Food Expenses",
            "reference_name": name,
            "description": f"Please review Expense Claim {name} - State: {workflow_state}",
            "priority": "High",
            "status": "Open",
            "date": frappe.utils.today()
        })
        todo_doc.insert(ignore_permissions=True)

        # Share the document with the user
        frappe.share.add("Food Expenses", name, row['email'], read=1, write=0)

        created.append(row['email'])

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
def get_employee_name(name): 
    response = frappe.db.sql('''
        SELECT `employee_name`
            FROM `tabEmployee`
            WHERE
            `name` = %s
            AND `status` = 'Active'
        ''', (name, ), as_dict=True)
        
    if not response:
        return {'status': 404, 'message': "The user account you are logged in with does not exist or is not currently active. Please contact your system administrator to resolve this issue."}
    else:
        return {'status': 200, 'data': response}
