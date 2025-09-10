import frappe

@frappe.whitelist()
def update_status(refresh_id):
    response = frappe.db.sql(''' 
        SELECT 
            `name`
        FROM
            `tabEmployee Advance`
        WHERE
            `name` = %s
        AND 
            `workflow_state` = 'unpaid'
        AND 
            `docstatus` = 1
                             
    ''', (refresh_id, ), as_dict = True)
    if not response:
        return {'status': 404, 'message': 'No data has been found'}
    else:
        frappe.db.set_value("Employee Advance", refresh_id, "workflow_state", 'paid', update_modified=True)
        return {"status": 201, 'message': 'updated Successfuly'}


@frappe.whitelist()
def cancel_advace(refresh_id):
    response = frappe.db.sql(''' 
        SELECT 
            `name`
        FROM
            `tabEmployee Advance`
        WHERE
            `name` = %s
        AND 
            `workflow_state` = 'paid'
        AND 
            `docstatus` = 1
                             
    ''', (refresh_id, ), as_dict = True)
    if not response:
        return {'status': 404, 'message': 'No data has been found'}
    else:
        frappe.db.set_value("Employee Advance", refresh_id, "workflow_state", 'unpaid', update_modified=True)
        return {"status": 201, 'message': 'updated Successfuly'}