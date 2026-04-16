let liaison_officer= null;
let project_manager = null;
let on_behalf = null;
let employee = null;
let project_manager_email = null;
let repeted = 0;
frappe.ui.form.on('Expense Claim', {
    validate:function(frm){
        // check on the if photo exist
        if(frm.doc.custom_espense_type === "Expense Claim"){
            const empty_attach = []
            let empty_recods_text = ""
            frm.doc.expenses.find((item) => {
                if(!item.invoice_image){
                    empty_attach.push(item.idx)
                }
            })
    
            if(empty_attach.length > 0){
                empty_attach.forEach((item) => {
                    empty_recods_text+= item + ", "
    
                })
    
                frappe.throw(`please add attach to records ${empty_recods_text} in expenses table to continue the process`)
            }
        }
    },
    after_save:function(frm){
        update_expense_calim(frm)
    },
    project:async function(frm){
        // always get the project data
        if(frm.doc.project){
            get_project_data(frm);
        }
    },
    after_workflow_action:async function(frm){
        if(frm.doc.workflow_state === "Approved" && (frm.doc.custom_espense_type === "Replenishment" || frm.doc.custom_espense_type === "Project petty-cash End")){
            await update_food(frm)
        }
        
        if(frm.doc.custom_espense_type !== "Expense Claim"){
          if(frm.doc.workflow_state !== "Initiator" && (frm.doc.workflow_state !== "Approved" && frm.doc.workflow_state !== "Rejected")){
            await add_assigend_to(frm)
          }
        }else{
            if((frm.doc.workflow_state !== "Initiator" || frm.doc.workflow_state !== "On Behalf") && (frm.doc.workflow_state !== 'Rejected' || frm.doc.workflow_state !== 'Approved')){
                await add_assigend_to(frm)
            }

        }

       if(frm.doc.custom_espense_type === 'Replenishment' && frm.doc.workflow_state  === "Approved" ){
           await create_new_advance(frm, frm.doc.total_sanctioned_amount)
        }
    },

    employee:async function(frm){
        if(frm.doc.custom_espense_type === "Expense Claim"){
            get_employee_company(frm) 
            await get_all_advances(frm)
        }else if(frm.doc.custom_espense_type === "Replenishment"){
            await get_project_advance(frm)
        }else if(frm.doc.custom_espense_type === "Petty-cash Project End"){
            await get_project_advance(frm)
        }
    },
    before_workflow_action: async function (frm) {
        if(frm.doc.custom_espense_type === "Expense Claim" && frm.doc.workflow_state === "Initiator"){
            setTimeout(() => {
                skip_on_behalf_status(frm);
            }, 100)
        }
        if((frm.selected_workflow_action === "Return" && frm.doc.workflow_state === "Project Manager") && frm.doc.custom_espense_type === "Expense Claim"){
            setTimeout(() => {
                skip_on_behalf_in_return(frm)
            }, 100)
        }
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




    },
	refresh:async function(frm) {
        const curr_employee = await get_employee_number_on_stand_alone(frm)
        
        // project manager validation
        if(!frm.is_new()){
                await get_project_data(frm)
                if(frm.doc.workflow_state === "Project Manager"){
                    if(curr_employee.message.employee_num !== project_manager && !frappe.user.has_role("System Manager")){
                        frm.page.actions_btn_group.hide();
                    }
                }
        }

        



        if(frm.doc.custom_espense_type !== "Expense Claim"){
            
            if(frm.is_new() || frm.doc.workflow_state === "Initiator"){
                if(curr_employee.message.employee_num === frm.doc.custom_liaison_officer || frappe.user.has_role("System Manager")){
                    if(frm.doc.custom_espense_type === "Replenishment" || frm.doc.custom_espense_type === "Petty-cash Project End"){
                        frm.add_custom_button("Fetch Food", () => {
                            food_poopup(frm)
                            
                        });
                        
                    }
                }
            }
            
            if(frm.doc.workflow_state === "Initiator"){
                if(curr_employee.message.employee_num !== frm.doc.custom_liaison_officer && !frappe.user.has_role("System Manager")){
                    frm.page.actions_btn_group.hide();
                }
                
            }else if(frm.doc.workflow_state === "On Behalf"){
                if(curr_employee.message.employee_num !== frm.doc.employee && !frappe.user.has_role("System Manager")){
                    frm.page.actions_btn_group.hide();
                }

            }
        
        }else{
            
            await get_employee_number_on_stand_alone(frm)
            if(frm.doc.workflow_state === "Initiator"){
                if(curr_employee.message.employee_num !== frm.doc.employee && !frappe.user.has_role("System Manager")){
                    frm.page.actions_btn_group.hide();
                }
            }
        }

        
        
        
        
        
        
        
        // think of it later
        // if(frm.doc.workflow_state === "Rejected"){
        //     if(frm.doc.custom_rejected_reason){
        //         const dialog = new frappe.ui.Dialog({
        //                     title: __('Notice'),
        //                     fields: [
        //                         {
        //                             fieldtype: 'HTML',
        //                             fieldname: 'message',
        //                             options: `<div style="padding:1rem; font-size:1rem;">
        //                                         ${frm.doc.custom_rejected_reason}
        //                                     </div>`
        //                         }
        //                     ],
        //                     primary_action_label: null,
        //                     secondary_action: null
        //                 });

        //                 dialog.show();
        //     }
        // }


       
	},
    
})

frappe.ui.form.on("Expense Claim Detail", {
    invoice_image:function(frm, cdt, cdn){
        frm.doc.__unsaved = false;
        
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
    expenses_add:function(frm, cdn, cdt){
        const row = locals[cdn][cdt];
        row.project = frm.doc.project
        frm.refresh_field('expenses')
    }
});





function update_expense_calim(frm){
    frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.update_expense_claim",
        args:{name:frm.doc.name},
        reeze:true,
        freeze_message :__("Updateing Expesne Claim Please waite..."),
        callback:function(response){
            if(response.message.status === 201){
                frappe.show_alert({
                    message: __("Expense Claim has been updated successfully"),
                    indicator: "green"
                });
                frm.reload_doc();
            }
        }
    })

}

function assigenn_to_on_behalf(frm){
    frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.add_on_behalf",
        args:{employee:frm.doc.employee, name:frm.doc.name},
        callback:function(response){
            if(response.message.status === 201){
                frappe.show_alert({
                    message: __("On Behalf has been added"),
                    indicator: "green"
                });
                frm.reload_doc();
            }
        }
    })
}

async function get_employee_number_on_stand_alone(frm){
    const employee_number = await frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.get_employee_number_stand_alone",
        args:{user_id: frappe.user.name},
        callback:function(response){
            if(response.message.status === 200){
                if(!frm.doc.employee){
                    frm.set_value("employee", response.message.employee_num)
                    frappe.show_alert({
                            message: __(response.message.message),
                            indicator: "green"
                    });
                }
                return response.message.employee_num
            }else{
                frappe.show_alert({
                        message: __(response.message.message),
                        indicator: "red"
                });

            }
        }
    })
    return employee_number
}


function skip_on_behalf_in_return(frm){
    frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.skip_on_behalf_on_return",
        args:{name:frm.doc.name},
        callback:function(response){
            if(response.message.status === 201){
                frappe.show_alert({
                    message: __("On Behalf has been skiped"),
                    indicator: "green"
                });
                frm.reload_doc();
            }
        },
    })
}


function throw_error_message(frm){
    frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.throw_error_message",
        args:{name:frm.doc.name}
    })
}

function skip_on_behalf_status(frm){
    frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.skip_on_behalf",
        args:{name:frm.doc.name},
        callback:function(response){
            if(response.message.status === 201){
                frappe.show_alert({
                    message: __("On Behalf has been skiped"),
                    indicator: "green"
                });
                frm.reload_doc();
            }
        }
    })
}

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
        args:{name:frm.doc.name},
        freeze:true,
        freeze_message :__("add assigend to..."),
        callback:function(response){
            if(response.message.status === 201){
                frappe.show_alert({
                    message: __("Assigend to has been added successfully"),
                    indicator: "green"
                });
                frm.reload_doc();
            }
        }
    })

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
        args:{name:frm.doc.name},
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
                            frappe.model.set_value(row.doctype, row.name, "amount", parseFloat(amount));
                            frappe.model.set_value(row.doctype, row.name, "sanctioned_amount", parseFloat(amount));
                            frappe.model.set_value(row.doctype, row.name, "expense_food_name", name);
                            frappe.model.set_value(row.doctype, row.name, "project", frm.doc.project);
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


async function fetch_cost_center(frm){
    frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.fetch_cost_center",
        args:{name:frm.doc.name, comp:frm.doc.company, porj:frm.doc.project,},
        callback:function(response){
            if(response.message.status === 200){
                if(response.message.data !== frm.doc.cost_center){
                    frm.set_value('cost_center', response.message.data)
                }
            }
        }
    })


}

async function get_project_data(frm){
    let project_manager_number = ""
    let user_id = ""
    const response = await frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.get_project_data_expense",
        args:{project:frm.doc.project}
    })
    
    if(response.message.status === 404){
        frappe.throw(response.message.message)
    }else{
       response.message.data.map((item) =>{
        //    liaison_officer = item.custom_liaison_officer
        project_manager_number = item.project_manager
        project_manager = item.project_manager
        // if(frm.doc.custom_espense_type !== "Expense Claim"){
        //     on_behalf = item.custom_on_behalf   
        // }
        petty_cahs_amount = item.custom_pettycash_amount
       }) 
       const project_manager_data = await get_project_manager_email(project_manager_number)
       if(!frm.doc.expense_approver){
            project_manager_data.message.data.map((item) => {
                user_id = item.user_id
            })
            frm.set_value("expense_approver", user_id)
       }
    }
}
async function get_project_manager_email(project_manager_number){
    const response = await frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.get_project_manager_email",
        args:{epmloyee:project_manager_number}
    });
    if(response.message.status === 404){
    }else{
        response.message.data.map((item) => {
            project_manager_email = item.user_id
        })
        
    }

    return response
}
async function get_employee_number(frm){
    const response = await frappe.call({
        method:"advance.overrides.employee_advance.employee_advance.get_employee_number",
        args:{user:frappe.session.user}
    });
    if(response.message.status === 404){
        // frappe.throw('You are accessing this page incorrectly. Please access it through the proper procedure.')
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
    frm.clear_table("advances");
    frm.refresh_field("advances")
    if(response.message.status === 200){
        response.message.data.forEach(item => name_of_advance.push(item.name))
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
    frm.clear_table("advances");
    frm.refresh_field("advances")
    
    
    
    // has been disabled untill we finsh implemnt the advance
    
    // const response = await frappe.call({
    //     method:"advance.overrides.expense_claim.expense_claim.get_advances_without_project",
    //     args:{employee:frm.doc.employee}
    // })
    
    // if(response.message.status === 200){
    //     response.message.data.forEach(item => name_of_advance.push(item.name))
    //     if(name_of_advance.length > 0){
    //         name_of_advance.map((item) => {
    //             let row = frm.add_child("advances");
    //             frappe.model.set_value(row.doctype, row.name, "employee_advance", item);
    //         })
    //         frm.refresh_field("advances")
    //     }
    // }
}





function get_employee_company(frm){
    frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.get_company_by_employee",
        args:{employee:frm.doc.employee},
        callback: async function(response){
            if(response.message.status === 200){
                frm.set_value('company', response.message.data.company)
                frm.set_value('expense_approver', response.message.data.expense_approver)
            }else{
                frappe.throw(`No company has been assigend to employee ${frm.doc.employee}`)
            }
        }
    })
}

