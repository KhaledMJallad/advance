import frappe
from frappe import _
import json
# class CustomExpenseClaim(ExpenseClaim):


@frappe.whitelist()
def get_employee_id(user):
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
        return {'status':404 , 'message':'No data was found'}
    else:
        return{'status':200 , 'data':response}