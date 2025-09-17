# Copyright (c) 2025, Khaled Jallad and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class FoodExpenses(Document):
   def validate(self):
    # Collect all file urls from child table
    file_urls = [row.invoice_image for row in self.expenses if row.invoice_image]
    if not file_urls:
        return

    # Fetch matching file records in one query
    response = frappe.db.sql(''' 
        SELECT name, file_url, is_private
        FROM `tabFile`
        WHERE file_url IN %(file_urls)s
    ''', {"file_urls": tuple(file_urls)}, as_dict=True)

    # Existing attachments for this doc (avoid duplicates)
    existing_files = frappe.get_all(
        "File",
        filters={
            "attached_to_doctype": self.doctype,
            "attached_to_name": self.name,
            "file_url": ["in", file_urls]
        },
        pluck="file_url"
    )

    # Insert only missing ones
    for row in response:
        if row["file_url"] not in existing_files:
            frappe.get_doc({
                "doctype": "File",
                "file_url": row["file_url"],
                "is_private": row["is_private"],
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
def get_resorec_pool(project, date):
    response = frappe.db.sql(''' 
    SELECT 
        `employee`
    FROM 
        `tabProject Assignment`
    WHERE 
        `project` = %s
    AND 
        `start_date` <=%s
    AND 
        `end_date` >= %s
    

    ''', (project, date, date, ), as_dict=True)
    if not response:
         return {
            'status': 404,
            'message': "No resources have been allocated for this project."
        }
    else:
         return {
            'status': 200,
            'data': response
         }
@frappe.whitelist()
def get_project_data(project_name):
    response = frappe.db.sql(''' 
        SELECT 
            `expected_start_date`,
            `expected_end_date`,
            `custom_liaison_officer`,
			`project_manager`,
            `custom_pettycash_amount`,
            `custom_on_behalf`
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
    AND `workflow_state` != 'Rejected'
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
	
#############################################################################
# @frappe.whitelist()
# def assign_food_expenses(workflow_state, project_manager, name):
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
#           AND u.enabled = 1
#     ''', (workflow_state,), as_dict=True)

#     print('response_email:', response)

#     if not response:
#         return {'status': 404, 'message': 'No Employee has been found'}

#     clear_email = []

#     for row in response:
#         if row['email'] == 'admin@example.com':
#             continue

#         if row['allowed'] == 'Projects Manager':
#             project_mgr_user = frappe.db.sql('''
#                 SELECT user_id 
#                 FROM `tabEmployee`
#                 WHERE name = %s AND status = 'Active'
#             ''', (project_manager,), as_dict=True)

#             if project_mgr_user and project_mgr_user[0]['user_id'] != 'admin@example.com':
#                 clear_email.append({'email': project_mgr_user[0]['user_id']})
#         else:
#             clear_email.append(row)

#     # ---- Create ToDo and Share ----
#     status = ['Open', 'Pending']
#     created, skipped = [], []

#     for row in clear_email:
#         exists = frappe.db.exists(
#             "ToDo",
#             {
#                 "reference_type": "Food Expenses",
#                 "reference_name": name,
#                 "allocated_to": row['email'],
#                 "status": ("in", status)
#             }
#         )

#         if exists:
#             skipped.append(row['email'])
#             continue

#         # Create ToDo
#         todo_doc = frappe.get_doc({
#             "doctype": "ToDo",
#             "allocated_to": row['email'],
#             "reference_type": "Food Expenses",
#             "reference_name": name,
#             "description": f"Please review Expense Claim {name} - State: {workflow_state}",
#             "priority": "High",
#             "status": "Open",
#             "date": frappe.utils.today()
#         })
#         todo_doc.insert(ignore_permissions=True)

#         # Share the document with the user
#         frappe.share.add("Food Expenses", name, row['email'], read=1, write=1)

#         created.append(row['email'])

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
############################################################

######################################################## Edit
@frappe.whitelist()
def assign_food_expenses(workflow_state, project_manager, name, on_behalf):
    # If workflow state is "Initiator", skip the whole function
    if workflow_state == "Initiator":
        return {
            'status': 200,
            'message': 'Skipped assignment for Initiator state'
        }

    clear_email = []

    # Get current document information
    doc = frappe.get_doc("Food Expenses", name)
    doc_owner = doc.owner  # Original document owner

    # Get employee associated with the document
    doc_employee_user = None
    if doc.employee:
        employee_doc = frappe.get_doc("Employee", doc.employee)
        doc_employee_user = employee_doc.user_id

    # Handle "On Behalf" workflow state
    if workflow_state == "On Behalf":
        if on_behalf:
            on_behalf_user = frappe.db.sql('''
                SELECT user_id 
                FROM `tabEmployee`
                WHERE name = %s AND status = 'Active'
            ''', (on_behalf,), as_dict=True)

            if on_behalf_user and on_behalf_user[0]['user_id'] != 'admin@example.com':
                clear_email.append({'email': on_behalf_user[0]['user_id']})
            else:
                return {
                    'status': 404,
                    'message': 'Project Manager not found or inactive'
                }
        else:
            return {
                'status': 400,
                'message': 'On behalf parameter is required for On Behalf workflow state'
            }

    # Handle "Project Manager" workflow state
    elif workflow_state == "Project Manager":
        if project_manager:
            project_mgr_user = frappe.db.sql('''
                SELECT user_id
                FROM `tabEmployee`
                WHERE name = %s AND status = 'Active'
            ''', (project_manager,), as_dict=True)

            if project_mgr_user and project_mgr_user[0]['user_id'] != 'admin@example.com':
                clear_email.append({'email': project_mgr_user[0]['user_id']})
            else:
                return {
                    'status': 404,
                    'message': 'Project Manager not found or inactive'
                }
        else:
            return {
                'status': 400,
                'message': 'project_manager parameter is required for Project Manager workflow state'
            }

    # For other workflow states, use role-based search
    else:
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
            return {
                'status': 404,
                'message': 'No Employee has been found'
            }

        for row in response:
            if row['email'] == 'admin@example.com':
                continue

            if row['allowed'] == 'Projects Manager':
                project_mgr_user = frappe.db.sql('''
                    SELECT user_id
                    FROM `tabEmployee`
                    WHERE name = %s AND status = 'Active'
                ''', (project_manager,), as_dict=True)

                if project_mgr_user and project_mgr_user[0]['user_id'] != 'admin@example.com':
                    clear_email.append({'email': project_mgr_user[0]['user_id']})

            elif row['allowed'] == 'Employee':
                # For Employee role: only the employee themselves and the owner
                if row['email'] == doc_employee_user or row['email'] == doc_owner:
                    clear_email.append(row)

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
        frappe.share.add("Food Expenses", name, row['email'], read=1, write=1, share=1)
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

##################################################################


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
