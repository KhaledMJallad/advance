import frappe
from frappe.utils import flt
from frappe import _
from frappe.utils.file_manager import get_file, save_file
from hrms.hr.doctype.expense_claim.expense_claim import ExpenseClaim
import json
class CustomExpenseClaim(ExpenseClaim):
    def validate(self):
        
        fetch_cost_center_and_pyable_account(self) 
        image_show(self)
        # has been turnd off untill we work on the advance module
        # update_expense_claim_advances(self)
        if self.custom_espense_type != "Expense Claim":
            update_petty_cash(self)









def image_show(self):
    for row in self.expenses:
        if row.invoice_image:
            if row.invoice_image.startswith("/private/files/"):
                file_doc_name = frappe.db.get_value("File", {"file_url": row.invoice_image}, "name")
                
                

                old_file = frappe.get_doc("File", file_doc_name)
                is_old_file_exist = frappe.db.exists("File",{
                    "file_url": f"/files/{old_file.file_name}",
                    "is_private": 0
                })

                if not is_old_file_exist:
                    old_file.is_private = 0
                    old_file.save(ignore_permissions=True)
                    # new_file = frappe.get_doc({
                    #     "doctype": "File",
                    #     "file_url": old_file.file_url,
                    #     "file_name": old_file.file_name,
                    #     "attached_to_doctype": "Expense Claim",
                    #     "attached_to_name": self.name,
                    #     "is_private": 0
                    # })
                    # new_file.save(ignore_permissions=True)
                    

                    row.invoice_image = old_file.file_url
                else:
                    public_old_file = frappe.get_doc("File", is_old_file_exist)
                    # new_file = frappe.get_doc({
                    #     "doctype": "File",
                    #     "file_url": public_old_file.file_url,
                    #     "file_name": public_old_file.file_name,
                    #     "attached_to_doctype": "Expense Claim",
                    #     "attached_to_name": self.name,
                    #     "is_private": 0
                    # })
                    # new_file.save(ignore_permissions=True)
                    

                    row.invoice_image = public_old_file.file_url
                
                
                
              


  




def update_petty_cash(self):
    if self.custom_pettycash:
        frappe.db.set_value("Petty-cash", self.custom_pettycash, "custom_expense_claim", self.name, update_modified=True)
        frappe.db.commit()

def fetch_cost_center_and_pyable_account(self):
    if not self.project:
        frappe.throw("please insert a project before save")

    cost_center = frappe.db.get_value('Project', self.project, 'cost_center')


    last_index = cost_center.rfind('-')
    
    if last_index != -1:
        cost_center = cost_center[:last_index].strip()

    if  self.company == 'iValueJOR':
        cost_center += ' - iJOR'
    elif self.company == 'iValueUAE':
         cost_center += ' - iUAE'
    elif self.company =='iValue KSA':
        cost_center += ' - iKSA'
    else:
        cost_center += ' - iV'

    

    for row in self.expenses:
        row.cost_center = cost_center
        row.project = self.project
    
    self.cost_center = cost_center
    
    if self.custom_espense_type != "Expense Claim":
        self.payable_account = "1620 - Petty Cash - iKSA"
    


def update_expense_claim_advances(self):
    if not self.advances or len(self.advances) == 0:
        return {"status": 203, "message": "No advances found"}

    # choose the total you want to distribute
    grand_total = flt(self.total_sanctioned_amount or 0)

    if grand_total <= 0:
        return {"status": 203, "message": "Grand total / sanctioned amount is zero"}

    remaining_amount = grand_total

    for item in self.advances:
        unclaimed_amount = flt(item.unclaimed_amount or 0)

        if remaining_amount <= 0:
            item.allocated_amount = 0
            continue

        if unclaimed_amount >= remaining_amount:
            item.allocated_amount = remaining_amount
            remaining_amount = 0
        else:
            item.allocated_amount = unclaimed_amount
            remaining_amount -= unclaimed_amount

    total_advance = sum(d.allocated_amount or 0 for d in self.advances)
    self.grand_total = self.total_sanctioned_amount - total_advance 
    self.total_advance_amount = total_advance
    


@frappe.whitelist()
def add_on_behalf(employee, name):
    # Check if ToDo already exists and is still open/pending
    user_id = frappe.db.get_value("Employee", employee, "user_id")
    status = ["Open", "Pending"]
    exists = frappe.db.exists(
            "ToDo",
            {
                "reference_type": "Expense Claim",
                "reference_name": name,
                "allocated_to": user_id,
                "status": ("in", status),
            },
        )

    if not exists:
        todo = frappe.get_doc(
                {
                    "doctype": "ToDo",
                    "allocated_to": user_id,
                    "reference_type": "Expense Claim",
                    "reference_name": name,
                    "description": "Please approve the employee signtuer {name}",
                    "priority": "High",
                    "status": "Open",
                    "date": frappe.utils.today(),
                }
            )
        todo.insert(ignore_permissions=True)
        frappe.share.add("Expense Claim", name, user_id, read=1, write=1, share=1)
    return {'status': 201 , 'message': "on behalf has been added successflly"}

@frappe.whitelist()
def get_employee_number_stand_alone(user_id):
    if not user_id:
        return {'status': 404, 'message': "no user id has been found"}
    
    employee_number = frappe.db.get_value("Employee", {"user_id": user_id}, "name")
    
    if employee_number:
        return {'status': 200, 'message': "Employee number has been fetched successfully", "employee_num": employee_number}
    else:
        return {"status": 404, "message": "No employee number has been assigend to this user"}


@frappe.whitelist()
def skip_on_behalf_on_return(name):
    if not name:
        frappe.throw("Expense Claim name is required")

    if not frappe.db.exists("Expense Claim", name):
        frappe.throw(f"Expense Claim {name} not found")
        
    frappe.db.set_value('Expense Claim', name, 'workflow_state', 'Initiator')
    frappe.db.commit()  

    return {"status": 201 , 'message': 'no behalf has been skiped successfully'}


@frappe.whitelist()
def skip_on_behalf(name):
    
    if not name:
        frappe.throw("Expense Claim name is required")
        
    if not frappe.db.exists("Expense Claim", name):
        frappe.throw(f"Expense Claim {name} not found")

    add_assigened_to(name)

    frappe.db.set_value('Expense Claim', name, 'workflow_state', 'Project Manager')
    frappe.db.commit()

    return {"status": 201 , "message": 'no behalf has been skiped successfully'}
        


@frappe.whitelist()
def force_to_save(name):
    doc =  frappe.get_doc('Expense Claim', name)
    doc.insert(ignore_permissions=True)
    return {"status": 201, 'message': "data has been saved successfuly"}




def add_assigened_to(name):
    doc = frappe.get_doc("Expense Claim", name)
    
    fetch_project_manager = frappe.db.get_value("Project", doc.project, "project_manager")

    user_id = frappe.db.get_value("Employee", fetch_project_manager, "user_id")

    status = ["Open", "Pending"]

        
        # Check if ToDo already exists and is still open/pending
    exists = frappe.db.exists(
            "ToDo",
            {
                "reference_type": "Expense Claim",
                "reference_name": name,
                "allocated_to": user_id,
                "status": ("in", status),
            },
        )

    if not exists:
        todo = frappe.get_doc(
                {
                    "doctype": "ToDo",
                    "allocated_to": user_id,
                    "reference_type": "Expense Claim",
                    "reference_name": name,
                    "description": "Please approve the employee signtuer {name}",
                    "priority": "High",
                    "status": "Open",
                    "date": frappe.utils.today(),
                }
            )
        todo.insert(ignore_permissions=True)
       
    frappe.share.add("Expense Claim", name, user_id, read=1, write=1, share=1)


######################################################################### Edit
@frappe.whitelist()
def share_with_and_assign_to(name):
    doc = frappe.get_doc("Expense Claim", name)
    status = ["Open", "Pending"]
    
    if doc.workflow_state == "On Behalf":
        user_id = frappe.db.get_value("Employee", doc.employee, "user_id")
        exists = frappe.db.exists(
                "ToDo",
                {
                    "reference_type": "Expense Claim",
                    "reference_name": name,
                    "allocated_to": user_id,
                    "status": ("in", status),
                },
            )

        if not exists:
            todo = frappe.get_doc(
                    {
                        "doctype": "ToDo",
                        "allocated_to": user_id,
                        "reference_type": "Expense Claim",
                        "reference_name": name,
                        "description": f"Please approve Expense claim name {name}",
                        "priority": "High",
                        "status": "Open",
                        "date": frappe.utils.today(),
                    }
                )
            todo.insert(ignore_permissions=True)
        frappe.share.add("Expense Claim", name, user_id, read=1, write=1, share=1)
    elif doc.workflow_state == "Project Manager":
        get_project_manager = frappe.db.get_value("Project", doc.project, "project_manager")
        user_id = frappe.db.get_value("Employee", get_project_manager, "user_id")
        exists = frappe.db.exists(
                "ToDo",
                {
                    "reference_type": "Expense Claim",
                    "reference_name": name,
                    "allocated_to": user_id,
                    "status": ("in", status),
                },
            )

        if not exists:
            todo = frappe.get_doc(
                    {
                        "doctype": "ToDo",
                        "allocated_to": user_id,
                        "reference_type": "Expense Claim",
                        "reference_name": name,
                        "description": f"Please approve Expense claim name {name}",
                        "priority": "High",
                        "status": "Open",
                        "date": frappe.utils.today(),
                    }
            )
            todo.insert(ignore_permissions=True)
        frappe.share.add("Expense Claim", name, user_id, read=1, write=1, share=1)
    elif doc.workflow_state == "Accountant":
        users = frappe.db.sql(
                """
                SELECT DISTINCT hr.parent AS user_id
                FROM `tabHas Role` hr
                JOIN `tabUser` u ON u.name = hr.parent
                WHERE hr.role = %s
                AND hr.parenttype = 'User'
                AND u.enabled = 1
                AND u.user_type = 'System User'
                """,
                ("Accounts User",),
                as_dict=True,
            )
        for item in users:
            if item['user_id'] != "Administrator":
                user_id = item["user_id"]
                # Check if ToDo already exists and is still open/pending
                exists = frappe.db.exists(
                    "ToDo",
                    {
                        "reference_type": "Expense Claim",
                        "reference_name": name,
                        "allocated_to": user_id,
                        "status": ("in", status),
                    },
                )

                if not exists:
                    todo = frappe.get_doc(
                        {
                            "doctype": "ToDo",
                            "allocated_to": user_id,
                            "reference_type": "Expense Claim",
                            "reference_name": name,
                            "description": f"Please approve Expense claim name {name}",
                            "priority": "High",
                            "status": "Open",
                            "date": frappe.utils.today(),
                        }
                    )
                    todo.insert(ignore_permissions=True)
                
                frappe.share.add("Expense Claim", name, user_id, read=1, write=1, share=1)

    return {'status': 201, "message": "assigend to has been added successfully"}
#########################################################################


@frappe.whitelist()
def change_to_lission_officer(name, liaison_officer):
    frappe.db.set_value("Expense Claim", name, "employee", liaison_officer, update_modified=True)
    frappe.db.commit()
    return {'status': 201, 'message': 'successfuly updated'}

@frappe.whitelist()
def change_employee_to_on_bahalf(name, on_behalf):
    frappe.db.set_value("Expense Claim", name, "employee", on_behalf, update_modified=True)
    frappe.db.commit()
    return {'status': 201, 'message': 'successfuly updated'}


@frappe.whitelist()
def change_doc_type_status(name):
    doc = frappe.get_doc("Expense Claim", name)
    doc.docstatus = 1   
    doc.save()



@frappe.whitelist()
def create_advance(name ,employee, petty_cash_amount, project, company, petty_cash):
    try:
        advance = frappe.new_doc("Employee Advance")
        advance.employee = employee
        advance.advance_amount = float(str(petty_cash_amount).replace(",", ""))
        advance.exchange_rate = 1
        advance.advance_account = '1620 - Petty Cash - iKSA'
        advance.company = company
        advance.posting_date = frappe.utils.nowdate()
        advance.purpose = "Project petty-cash Request"
        advance.custom_project = project

        advance.insert(ignore_permissions=True)
        advance.submit()

        frappe.db.set_value("Expense Claim", name, "custom_advance", advance.name)
        frappe.db.set_value("Petty-cash", petty_cash, "custom_advance", advance.name)
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
def update_food(name):
    doc = frappe.get_doc("Expense Claim", name)
    
    for row in doc.expenses:
        if row.expense_food_name:
            frappe.db.set_value("Food Expenses", row.expense_food_name, "expense_claim", name)
            frappe.db.set_value("Food Expenses", row.expense_food_name, "workflow_state", 'paid')
    frappe.db.commit()

    return {"status": 201, "message": "Food Expense has been updated successfully"}
    
        
@frappe.whitelist()
def get_employee_advance(project, employee):
    response = frappe.db.sql(''' 
        SELECT 
        `advance_amount`,
        `name`,
        `posting_date`
        FROM `tabEmployee Advance`
        WHERE 
            `custom_project` = %s
        AND 
            `employee` = %s
        AND 
            status = 'Paid'
        ''', (project, employee, ), as_dict=True)
    
        
    if not response:
            return {'status':404 , 'message':'No data was found'}
    else:
            return {'status':200 , 'data':response}
@frappe.whitelist()
def get_project_data_expense(project):
    response = frappe.db.sql("""
        SELECT 
            `name`,
            `project_name`,
            `expected_start_date`,
            `expected_end_date`,
            `custom_liaison_officer`,
            `project_manager`,
            `custom_pettycash_amount`,
            `custom_on_behalf`
        FROM `tabProject`
        WHERE 
            `name` = %s
            AND `status` = 'Open'
    """, (project,), as_dict=True)

    if not response:
        return {
            'status': 404,
            'message': ("This project has either been completed or has not yet been declared. "
                        "Please contact the administrator to resolve this issue.")
        }
    else:
        return {'status': 200, 'data': response}
        
@frappe.whitelist()
def get_project_manager_email(epmloyee):
    response = frappe.db.sql("""
        SELECT 
            `user_id`
        FROM `tabEmployee`
        WHERE 
            `name` = %s
            AND `status` = 'Active'
    """, (epmloyee,), as_dict=True)

    if not response:
        return {
            'status': 404,
            'message': ("This project has either been completed or has not yet been declared. "
                        "Please contact the administrator to resolve this issue.")
        }
    else:
        return {'status': 200, 'data': response}


@frappe.whitelist()
def get_advances_without_project(employee):
    response = frappe.db.sql("""
        SELECT 
            `advance_amount`,
            `name`,
            `posting_date`
        FROM `tabEmployee Advance`
        WHERE 
            `employee` = %s
            AND 
                `status` = 'Paid'
            AND 
                `custom_project` IS NULL 
        ORDER BY `posting_date` DESC
    """, (employee,), as_dict=True)
    
    if not response:
        return {
            'status': 404,
            'message': "No paid advances without a linked project were found for this employee."
        }
    else:
        return {'status': 200, 'data': response}
    

@frappe.whitelist()
def fetch_food(project, employee):
    response = frappe.db.sql(''' 
        SELECT 
            `total_sanctioned_amount`,
            `name`,
            `start_date`,
            `end_date`
        FROM 
            `tabFood Expenses`
        WHERE
            `project` = %s
        AND 
            `project` IS NOT NULL
        AND 
            `expense_claim` IS NULL
        AND 
            `docstatus` = 1
    ''', (project), as_dict = True)

    if not response:
        return {'status': 404, 'message': f"There are no food entries recorded."}
    else:
        return {'status': 200, 'data': response}






@frappe.whitelist()
def get_company_by_employee(employee):
    fetch_company = frappe.db.get_value('Employee', employee, ['company', 'expense_approver'], as_dict = True )
    if fetch_company:
        return {'status': 200, 'data':fetch_company}
    else:
        return {'status': 404, 'message': 'no company has been assigend to this employee'}
    


@frappe.whitelist()
def fetch_cost_center(name, comp, porj):
    if not porj:
        return {'status': 400, 'message': "No project has been inculded"}
    
    cost_center = frappe.db.get_value('Project', porj, 'cost_center')

    doc =  frappe.get_doc('Expense Claim', name)

    last_index = cost_center.rfind('-')
    if last_index != -1:
        cost_center = cost_center[:last_index].strip()

    if  comp == 'iValueJOR':
        cost_center += ' - iJOR'
    elif comp == 'iValueUAE':
         cost_center += ' - iUAE'
    elif comp =='iValue KSA':
        cost_center += ' - iKSA'
    else:
        cost_center += ' - iV'

    

    for row in doc.expenses:
        row.cost_center = cost_center

    doc.cost_center = cost_center
    doc.payable_account = "1620 - Petty Cash - iKSA"
    doc.save()

    # return last_name


@frappe.whitelist()
def fetch_cost_center_without_pyable_account(porj, name, comp):

    if not porj:
        return {'status': 400, 'message': "No project has been inculded"}
    
   

    return {"status": 201, 'message': "project and cost center has been fetched successfully"}

