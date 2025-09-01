import frappe

def before_uninstall():
    workflow_name = ["Petty-Cash Food", "Expense Food"]
    for wfn in workflow_name: 
    	if frappe.db.exists("Workflow", wfn):
        	frappe.delete_doc("Workflow", wfn, force=1)




