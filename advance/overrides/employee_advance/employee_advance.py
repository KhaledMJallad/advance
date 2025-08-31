import frappe
from frappe import _
from hrms.hr.doctype.employee_advance.employee_advance import EmployeeAdvance


# class CustomEmployeeAdvance(EmployeeAdvance):

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
            
