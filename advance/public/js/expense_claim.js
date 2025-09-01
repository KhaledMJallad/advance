let liaison_officer= null;
let project_manager = null;
let on_behalf = null;
let employee = null;
let project_manager_email = null;
let petty_cahs_amount = null;
frappe.ui.form.on('Expense Claim', {
    validate:async function (frm) {
        await get_project_data(frm)
        await share_file(frm)
        await change_employee_to_on_on_behalf(frm)
    },
    after_workflow_action:async function(frm){
        if(frm.doc.workflow_state === "Approved" && (frm.doc.custom_espense_type === "Project petty-cash Renewal" || frm.doc.custom_espense_type === "Project petty-cash End")){
            change_doc_type_status(frm)
        }
        if(frm.doc.workflow_state === 'Rejected' || frm.doc.workflow_state === "Initiator") return;
        add_assigend_to(frm)
    },

    before_workflow_action: async function (frm) {

        if(frm.selected_workflow_action === 'Reject'){
            frappe.dom.unfreeze();
            return new Promise(resolve => {
                frappe.prompt(
                  [{
                    fieldtype: 'Small Text',
                    fieldname: 'reject_reason',
                    label: __('Reason for Rejection'),
                    reqd: 1
                  }],
                  values => {
                    frm.set_value('custom_rejected_reason',  values.reject_reason);
                    frm.save().then(() => resolve());
                  },
                  __('Please provide a reason before rejecting')
                );
            });
        }
        if(frm.doc.custom_rejected_reason){
            frm.set_value('custom_rejected_reason', null);
        }

        if(frm.doc.custom_espense_type === 'Project petty-cash Request' && (frm.selected_workflow_action  === "Approve" && frm.doc.workflow_state === "Supporting Services Director")){
                await get_project_data(frm)
                await create_new_advance(frm, petty_cahs_amount)
        }else if(frm.doc.custom_espense_type === 'Project petty-cash Renewal' && (frm.selected_workflow_action  === "Approve" && frm.doc.workflow_state === "Supporting Services Director")){
            await update_food(frm, petty_cahs_amount)
            await create_new_advance(frm, frm.doc.total_sanctioned_amount)
        }


    },
	refresh:async function(frm) {
        if(!frm.doc.payable_account && frappe.user.has_role("Accounts User")){
            frm.set_value('payable_account', "2110 - Creditors - TD")
        }

         if(frm.doc.custom_rejected_reason &&  (liaison_officer === employee_number || frappe.user.has_role("System Manager"))){
                show_rejected_reson(frm)
         }

	    if(!frm.doc.project) return;
	    await get_employee_number(frm)
	    await get_project_data(frm)
	    await get_project_manager_email(frm)
	    frm.set_value('employee', liaison_officer)
        if(!frm.is_new()){
            if(frm.doc.custom_espense_type === "Project petty-cash Request"){
                frm.set_df_property('expenses', 'hidden', true)
            }else if (frm.doc.custom_espense_type === "Project petty-cash Renewal"){
                frm.set_df_property('expenses', 'hidden', false)
                if(frm.doc.workflow_state === "Initiator"){
                    frm.add_custom_button("Fetch Food", () => {
	                    food_poopup(frm)
	            
                    });
                }
            }else{
                frm.set_df_property('expenses', 'hidden', false)

            }
                
        }
	},
	employee:async function(frm){
        await get_all_advances(frm)
	    frm.set_value('expense_approver', project_manager_email)
	},
	custom_espense_type:async function(frm){
        await fetch_petty_cash_requested_and_end(frm)
        frm.clear_table("expenses");
        frm.refresh_field("expenses");
	    if(frm.doc.custom_espense_type === 'Project petty-cash Renewal'){
            await get_project_advance(frm)
	        if(frm.doc.advances.length === 0){
	            frm.set_value('custom_espense_type', 'Expense Claim')
	            frappe.throw('You must request a project petty cash before proceeding with the renewal.');
	        }
	        frm.add_custom_button("Fetch Food", () => {
	                food_poopup(frm)
	            
            });
            frm.set_df_property('expenses', 'reqd', true);  
            frm.set_df_property('expenses', 'hidden', false);
	    }else if(frm.doc.custom_espense_type === "Project petty-cash Request"){
            frm.set_df_property('expenses', 'reqd', false);  
            frm.set_df_property('expenses', 'hidden', true); 
            let row = frm.add_child('expenses');
            row.amount = 0.1
            row.sanctioned_amount = 0.1
            row.description = ''
            row.expense_type = 'Food-petty cash'
            frm.refresh_field("expenses")
        }else{
            frm.set_df_property('expenses', 'reqd', true);  
            frm.set_df_property('expenses', 'hidden', false); 
            await get_all_advances(frm)
	       frm.remove_custom_button("Fetch Food");
            
        }
	},
    
})

frappe.ui.form.on("Expense Claim Detail", {
    expenses_add: function(frm, cdt, cdn) {
        const allowe_type = ['Project petty-cash Renewal', 'Project petty-cash End'];
        if(allowe_type.includes(frm.doc.custom_espense_type)){
            frappe.model.set_value(cdt, cdn, "expense_type", "petty-cash");
        }
    }
});


async function change_doc_type_status(frm){
    const response = frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.change_doc_type_status",
        args:{name:frm.doc.name}
    })
}

async function change_employee_to_on_on_behalf(frm){
    const response = frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.change_employee_to_on_bahalf",
        args:{name:frm.doc.name, on_behalf:on_behalf}
    })
}
async function add_assigend_to(frm){
    const response = await frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.share_with_and_assign_to",
        args:{workflow_state:frm.doc.workflow_state, name:frm.doc.name, project_manager:project_manager}
    })

    if(response.message.status === 404){
        frappe.throw(response.message.message)
    }
}

async function share_file(frm){
    frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.image_show",
        args:{expenses:frm.doc.expenses, name:frm.doc.name}
    })
}

async function create_new_advance(frm, petty_cahs_amount_data){
    const response = frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.create_advance",
        args:{name:frm.doc.name, employee: frm.doc.employee, petty_cash_amount:petty_cahs_amount_data, project:frm.doc.project, company:frm.doc.company}
    })

}
async function update_food(frm) {
    const response = await frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.update_food",
        args:{expenses:frm.doc.expenses, name:frm.doc.name}
    });
}
async function fetch_petty_cash_requested_and_end(frm){
    let petty_cash_requested = 0;
    let petty_cash_end = 0
    const response = await frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.fetch_petty_cahs_request_and_end",
        args:{project:frm.doc.project}
    });

    if(response.message.status === 200){
        response.message.petty_cash_request.map((item) => {
            petty_cash_requested = item.requested
        })
         response.message.petty_cash_end.map((item) => {
            petty_cash_end = item.end
        })
    }

    if(frm.doc.custom_espense_type === "Project petty-cash Request"){
        if(petty_cash_requested > petty_cash_end){
            frm.set_value('custom_espense_type', 'Expense Claim')
            frappe.throw("You cannot submit a new request at this time, as there is already an active one in progress.")
        }
    }else if(frm.doc.custom_espense_type === "Project petty-cash Renewal" || frm.doc.custom_espense_type === "Project petty-cash End"){
        if(petty_cash_requested  <= petty_cash_end){
            frm.set_value('custom_espense_type', 'Expense Claim')
            frappe.throw("You cannot renew or close the petty cash before creating a new request.")
        }
    }
}

async function food_poopup(frm){
    let total_amount = 0;
    let name_arr = [];
    let names_str = []
    let expenses = frm.doc.expenses;
    let food_expenses = await fetch_food_expenses(frm);
    if(food_expenses.length === 0){
            frappe.throw('there is on food has been created.')
    }

    if(expenses.length > 0){
       name_arr = expenses.filter(item => item.expense_food_name)
       for(const item of name_arr){
           names_str.push(item.expense_food_name) 
       }


        if(names_str.length > 0){
        food_expenses.map((item) => {
            if(names_str.includes(item.label)){
                item.default = 1; 
            }else{
                item.default = 0; 
            }
        })

    }
    }
    
        
   
    let d = new frappe.ui.Dialog({
                title: 'Custom Popup Module',
                fields: food_expenses,
                primary_action_label: 'Submit',
                primary_action(values) {
                    Object.keys(values).forEach(key => {
                        if (values[key] === 1) {  
                            let row = frm.add_child('expenses');
                            let [name, amount] = key.split('_');
                            let amt = String(amount).replace(/,/g, ''); 
                            row.amount =  parseFloat(amt)
                            row.sanctioned_amount = parseFloat(amt)
                            row.expense_food_name =  name
                            row.description = 'Petty cash Food'
                            row.expense_type = 'Food-petty cash'
                            row.invoice_no = '0000000'
                            row.invoice_image = "You Can't add image to this"
                            frm.refresh_field("expenses")                            
                        }
                    });
                    
                    


                    d.hide();
                }
            });

            d.show();
}

async function get_project_data(frm){
    const response = await frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.get_project_data_expense",
        args:{project:frm.doc.project}
    })
    
    if(response.message.status === 404){
        frappe.throw(response.message.message)
    }else{
       response.message.data.map((item) =>{
           liaison_officer = item.custom_liaison_officer
           project_manager = item.custom_project_manager
           on_behalf = item.custom_on_behalf
           petty_cahs_amount = item.custom_pettycash_amount
       }) 
    }
}
async function get_project_manager_email(frm){
    const response = await frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.get_project_manager_email",
        args:{epmloyee:project_manager}
    });
    if(response.message.status === 404){
        frappe.throw(response.message.message)
    }else{
        response.message.data.map((item) => {
            project_manager_email = item.user_id
        })
        
        
    }
}
async function get_employee_number(frm){
    let employee_number = null;
    const response = await frappe.call({
        method:"advance.overrides.employee_advance.employee_advance.get_employee_number",
        args:{user:frappe.session.user}
    });
    if(response.message.status === 404){
        if(frappe.user.has_role("System Manager")){
            frm.set_df_property('custom_espense_type', 'read_only', false)
        }else{
            frm.set_df_property('custom_espense_type', 'read_only', true)
        }
    }else{
        response.message.data.map((item) => {
            employee_number = item.name
            employee = item.name
        })
        if(employee_number === liaison_officer){
            frm.set_df_property('custom_espense_type', 'read_only', false)
        }else{
            frm.set_df_property('custom_espense_type', 'read_only', true)
        }
    }
    
    
}
async function get_project_advance(frm){
    if(!frm.doc.project) return;
    let name_of_advance = [];
    const response = await frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.get_employee_advance",
        args:{project:frm.doc.project, employee:frm.doc.employee}
    })
    
    if(response.message.status === 200){
        response.message.data.forEach(item => name_of_advance.push(item.name))
        frm.clear_table("advances");
        frm.refresh_field("advances")
        name_of_advance.map((item) => {
        	let row = frm.add_child("advances");
        	frappe.model.set_value(row.doctype, row.name, "employee_advance", item);
        })
        frm.refresh_field("advances")
    }
    
}
async function fetch_food_expenses(frm){
    let food_expenses = [];
    const response = await frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.fetch_food",
        args:{project:frm.doc.project, employee:frm.doc.employee}
    });

    if(response.message.status === 404){
        frappe.throw(response.message.message)
    }else{

        response.message.data.map((item) => {
            food_expenses.push({
                label: item.name,
                fieldname: `${item.name}_${item.total_sanctioned_amount}`,
                fieldtype: 'Check'
            })  
            
        })

      
    
        return food_expenses;
    }
}
async function get_all_advances(frm){
    let name_of_advance = [];
    const response = await frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.get_advances_without_project",
        args:{employee:frm.doc.employee}
    })
    
    frm.clear_table("advances");
    frm.refresh_field("advances")
    if(response.message.status === 200){
        response.message.data.forEach(item => name_of_advance.push(item.name))
        if(name_of_advance.length > 0){
            name_of_advance.map((item) => {
                let row = frm.add_child("advances");
                frappe.model.set_value(row.doctype, row.name, "employee_advance", item);
            })
            frm.refresh_field("advances")
        }
    }
}


function show_rejected_reson(frm){
    const dialog = new frappe.ui.Dialog({
            title: __('Notice'),
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'message',
                    options: `<div style="padding:1rem; font-size:1rem;">
                                ${frm.doc.custom_rejected_reason}
                            </div>`
                }
            ],
            primary_action_label: __('OK'),
            primary_action: () =>{
                frm.set_value('custom_rejected_reason', null);
                dialog.hide();
            },
            secondary_action: null
        });

        dialog.show();
            
}
