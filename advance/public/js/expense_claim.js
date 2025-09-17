let liaison_officer= null;
let project_manager = null;
let on_behalf = null;
let employee = null;
let project_manager_email = null;
let payable_account = '1620 - Petty Cash - iKSA';
let repeted = 0;
frappe.ui.form.on('Expense Claim', {
    after_save:async function(frm){
        await update_petty_cash(frm)
        await share_file(frm)
    },
    after_workflow_action:async function(frm){
        if(frm.doc.workflow_state === "Approved" && (frm.doc.custom_espense_type === "Replenishment" || frm.doc.custom_espense_type === "Project petty-cash End")){
            await update_food(frm)
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


       if(frm.doc.custom_espense_type === 'Replenishment' && (frm.selected_workflow_action  === "Approve" && frm.doc.workflow_state === "Accountant Submit")){

            await create_new_advance(frm, frm.doc.total_sanctioned_amount)
        }


    },
	refresh:async function(frm) {
        if(frm.is_new()){
            if(!frm.doc.project) return;
            await get_project_data(frm);
            if(frappe.user.has_role("System Manager")){
                if(!frm.doc.payable_account){
                    frm.set_value('payable_account', payable_account)
                }
                frm.set_df_property('payable_account', 'read_only', false)
                frm.set_df_property('employee', 'read_only', true)
                frm.set_df_property('expense_approver', 'read_only', true)
                
                frm.set_value('employee', on_behalf)
                await get_project_manager_email(frm)
                await get_project_advance(frm)
                frm.set_value('expense_approver', project_manager_email)
                if(frm.doc.custom_espense_type === "Replenishment" || frm.doc.custom_espense_type === "Petty-cash Project End"){
                    frm.add_custom_button("Fetch Food", () => {
                        food_poopup(frm)
                    
                    });
                }
            }else{
                await get_employee_number(frm);
                if(employee === liaison_officer){
                    if(!frm.doc.payable_account){
                        frm.set_value('payable_account', payable_account)
                    }
       
                    frm.set_df_property('payable_account', 'read_only', true)
                    frm.set_df_property('employee', 'read_only', true)
                    frm.set_df_property('expense_approver', 'read_only', true)
                    frm.set_value('employee', on_behalf)
                    await get_project_manager_email(frm)
                    await get_project_advance(frm)
                    frm.set_value('expense_approver', project_manager_email)
                    if(frm.doc.custom_espense_type === "Replenishment" || frm.doc.custom_espense_type === "Petty-cash Project End"){
                    frm.add_custom_button("Fetch Food", () => {
                        food_poopup(frm)
                    
                    });
                }
                }else{
                    frm.set_df_property('employee', 'read_only', false)
                    frm.set_df_property('expense_approver', 'read_only', false)
                }
            }   
        }else{
            await get_project_data(frm);
            await get_employee_number(frm);
            if((employee === liaison_officer || frappe.user.has_role("System Manager")) &&  frm.doc.custom_rejected_reason){
                show_rejected_reson(frm);
            } 

              if(frm.doc.workflow_state === 'On Behalf'){
                if(on_behalf === employee || frappe.user.has_role("System Manager")){
                    frm.page.actions_btn_group.show(); 
                }else{
                    frm.page.actions_btn_group.hide();  
                }
            }

            if(frappe.user.has_role('Accounts User') || frappe.user.has_role('System Manager')){
                frm.set_df_property('payable_account', 'read_only', false)
                
            }else{
                frm.set_df_property(payable_account, 'read_only', true)
            }
        }
	},
    
})

frappe.ui.form.on("Expense Claim Detail", {
    invoice_image:function(frm, cdt, cdn){
        frm.doc.__unsaved = false
    },
      invoice_no: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        const expenses = frm.doc.expenses || [];
        if(!row.invoice_no) return;
        if (row.invoice_no) {

            const invoices = new Set();
            expenses.forEach(item => {
                // Add only other rows' invoice_no values
                if (item.name !== row.name && item.invoice_no) {
                    invoices.add(item.invoice_no);
                }
            });

            if (invoices.has(row.invoice_no) && !row.expense_food_name) {
                frappe.model.set_value(cdt, cdn, "invoice_no", null);   // clear value
                frm.refresh_field("expenses");
                frappe.throw(__('Please ensure that each invoice is assigned a unique number.'));
            }
        }
    },
     form_render: function(frm, cdt, cdn) {
        $(cur_frm.fields_dict["expenses"].grid.wrapper)
            .find('.control-value a')
            .off("click")
            .on("click", function(e) {
                e.preventDefault();
                e.stopPropagation();
                let $el = $(this);
                let doctype = $el.attr("data-doctype");
                let name = $el.text().trim();
                if (doctype && name) {
                    let url = frappe.utils.get_form_link(doctype, name);
                    window.open(url, "_blank");
                }
            });
    },
});


async function change_doc_type_status(frm){
    const response = frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.change_doc_type_status",
        args:{name:frm.doc.name}
    })
}

async function cahnge_expenses_to_lission_officer(frm){
     const response = frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.change_to_lission_officer",
        args:{name:frm.doc.name, liaison_officer:liaison_officer}
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
        args:{workflow_state:frm.doc.workflow_state, name:frm.doc.name, project_manager:project_manager, on_behalf:on_behalf}
    })

}

async function share_file(frm){
    await frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.image_show",
        args:{expenses:frm.doc.expenses, name:frm.doc.name},
        freeze: true,
        freeze_message: __("Uploading Files Please waite..."),
        callback: function(r) {
        if (r.message.status === 201) {
            frappe.show_alert({
                message: __("File linked successfully"),
                indicator: "green"
            }, 5);

            // refresh the page after success
            frm.reload_doc();
        } else {
            frappe.show_alert({
                message: __("Failed to link file"),
                indicator: "red"
            }, 5);
        }
    }
    });

}

async function create_new_advance(frm, petty_cahs_amount_data){
    const response = frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.create_advance",
        args:{
            name:frm.doc.name, 
            employee: frm.doc.employee, 
            petty_cash_amount:petty_cahs_amount_data, 
            project:frm.doc.project, 
            company:frm.doc.company,
            petty_cash: frm.doc.custom_pettycash
        }
    })

}
async function update_food(frm) {
    await frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.update_food",
        args:{expenses:frm.doc.expenses, name:frm.doc.name},
        freeze:true,
        freeze_message :__("Updateing Food Please waite..."),
         callback: function(r) {
        if (r.message.status === 201) {
            frappe.show_alert({
                message: __("Food has been updated successfuly"),
                indicator: "green"
            }, 5);

            // refresh the page after success
            frm.reload_doc();
        } 
    }

    });
}


async function food_poopup(frm){
    let total_amount = 0;
    let name_arr = [];
    let names_str = []
    let expenses = frm.doc.expenses;
    let food_expenses = await fetch_food_expenses(frm);
    if(food_expenses.length === 0){
            frappe.show_alert({
            message: __("There is no food has been created."),
            indicator: 'yellow'
        }); // 5 seconds
    }

    if(expenses.length > 0){
       name_arr = expenses.filter(item => item.expense_food_name)
       for(const item of name_arr){
            names_str.push(item.expense_food_name) 
       }

        if(names_str.length > 0){
        food_expenses.map((item) => {
            if(names_str.includes(item.fieldname.split('_')[0].trim())){
                item.default = 1; 
            }else{
                item.default = 0; 
            }
        })

    }
    }
    
        
   
    let d = new frappe.ui.Dialog({
                title: 'Food Expenses',
                fields: food_expenses,
                primary_action_label: 'Submit',
                primary_action(values) {
                    frm.doc.expenses = expenses.filter(row => !row.expense_food_name);
                    frm.refresh_field("expenses");
                    Object.keys(values).forEach(key => {

                        if (values[key] === 1) {  
                            let row = frm.add_child('expenses');
                            let [name, amount] = key.split('_');
                            let amt = String(amount).replace(/,/g, ''); 
                            frappe.model.set_value(row.doctype, row.name, "amount", parseFloat(amt));
                            frappe.model.set_value(row.doctype, row.name, "expense_food_name", name);
                            frappe.model.set_value(row.doctype, row.name, "description", 'Petty cash Food');
                            frappe.model.set_value(row.doctype, row.name, "expense_type", 'Hospitality Expenses');
                            frappe.model.set_value(row.doctype, row.name, "invoice_no", '0000000');
                            frappe.model.set_value(row.doctype, row.name, "invoice_image", "You Can't add image to this");
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
           project_manager = item.project_manager
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
    }else{
        response.message.data.map((item) => {
            project_manager_email = item.user_id
        })
        
    }
}
async function get_employee_number(frm){
    const response = await frappe.call({
        method:"advance.overrides.employee_advance.employee_advance.get_employee_number",
        args:{user:frappe.session.user}
    });
    if(response.message.status === 404){
        frappe.throw('You are accessing this page incorrectly. Please access it through the proper procedure.')
    }else{
        response.message.data.map((item) => {
            employee = item.name
        })
      
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
    let start_date = null;
    let end_date = null;
    const response = await frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.fetch_food",
        args:{project:frm.doc.project, employee:frm.doc.employee}
    });

    if(response.message.status === 404){
           frappe.msgprint(response.message.message)
    }else{

        response.message.data.map((item) => {
            start_date = item.start_date,
            end_date = item.end_date
            food_expenses.push({
                label: `${item.name} | Total Sanctioned Amount: ${item.total_sanctioned_amount} | from: ${start_date} -to: ${end_date}`,
                fieldname: `${item.name}_${item.total_sanctioned_amount}`,
                fieldtype: 'Check'
            })  
            
        })

      
    
        return  food_expenses;
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

async function update_petty_cash(frm){
    frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.update_petty_cash",
        args:{name:frm.doc.name, petty_cash:frm.doc.custom_pettycash},
        freeze: true,
        freeze_message: __("Updating petty-cash. Please waite..."),
        callback: function(r) {
        if (r.message.status === 201) {
            frappe.show_alert({
                message: __("File linked successfully"),
                indicator: "green"
            }, 5);

            // refresh the page after success
            frm.reload_doc();
        } else {
            frappe.show_alert({
                message: __("Failed to link file"),
                indicator: "red"
            }, 5);
        }
    }
    })
}

function show_rejected_reson(frm){
    if (repeted === 1) return;
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
            primary_action_label: null,
            secondary_action: null
        });

        dialog.show();

        repeted = 1;
            
}


