import frappe
from frappe import _
from hrms.hr.doctype.employee_advance.employee_advance import EmployeeAdvance


# class CustomEmployeeAdvance(EmployeeAdvance):

@frappe.whitelist()
def change_status(name):
    frappe.db.set_value("Employee Advance", name, "workflow_state", 'Cancel', update_modified=True)
    return {'status': 201, 'message': 'updated successfuly'}