import frappe

def before_insert(doc, method):
    frappe.logger().info("=== BEFORE INSERT CALLED ===")
    print("=== BEFORE INSERT CALLED ===")
    if doc.doctype == "Expense Claim":
        print("=== PROCESSING EXPENSE CLAIM BEFORE INSERT ===")
        set_ignore_flags(doc)

def before_save(doc, method):
    frappe.logger().info("=== BEFORE SAVE CALLED ===")
    print("=== BEFORE SAVE CALLED ===")
    if doc.doctype == "Expense Claim":
        print("=== PROCESSING EXPENSE CLAIM BEFORE SAVE ===")
        set_ignore_flags(doc)

def validate(doc, method):
    frappe.logger().info("=== VALIDATE CALLED ===")
    print("=== VALIDATE CALLED ===")
    if doc.doctype == "Expense Claim":
        print("=== PROCESSING EXPENSE CLAIM VALIDATE ===")
        set_ignore_flags(doc)

def set_ignore_flags(doc):
    print("=== SETTING IGNORE FLAGS ===")
    frappe.flags.ignore_permissions = True
    frappe.flags.ignore_validate_update_after_submit = True
    frappe.flags.ignore_links = True
    frappe.flags.ignore_mandatory = True
    
    doc.flags.ignore_permissions = True
    doc.flags.ignore_validate = True
    doc.flags.ignore_links = True
    print("=== FLAGS SET COMPLETED ===")