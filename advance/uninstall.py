import frappe

def remove_customizations():
  
    custom_fields = frappe.get_all("Custom Field", filters={"module": "advance"}, pluck="name")
    for field in custom_fields:
        frappe.delete_doc("Custom Field", field, force=1)

  
    frappe.clear_cache()

