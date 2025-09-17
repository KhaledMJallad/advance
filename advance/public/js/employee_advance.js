let lission_officer = null;
let petty_cash_amount = 0;
let employee_number = 0;
let project_manager = null;
let on_behalf = null;
frappe.ui.form.on('Employee Advance', {
    before_cancel: async function (frm) {
        await change_wf_status(frm)
    },
    after_workflow_action:async function(frm){
        await get_project_data(frm)
        add_assigen_to(frm)
    },
    refresh: async function (frm) {
        await get_employee_number(frm)
        await get_project_data(frm)
        if(!frm.is_new()){
            if(frm.doc.workflow_state === 'On Behalf'){
                if(on_behalf === employee_number){
                    frm.page.actions_btn_group.show(); 
                }else{
                    frm.page.actions_btn_group.hide();  
                }
            }
        }
    },
});



async function get_project_data(frm){
      const response = await frappe.call({
        method:"advance.overrides.expense_claim.expense_claim.get_project_data_expense",
        args:{project:frm.doc.custom_project}
    })
    
    if(response.message.status === 404){
        frappe.throw(response.message.message)
    }else{

       response.message.data.map((item) =>{
           project_manager = item.project_manager
           on_behalf = item.custom_on_behalf
       }) 
    }
}

async function add_assigen_to(frm){
     const response = await frappe.call({
        method:"advance.overrides.employee_advance.employee_advance.share_with_and_assign_to",
        args:{workflow_state:frm.doc.workflow_state, name:frm.doc.name, project_manager:project_manager}
    })
}

async function change_wf_status(frm){
    if(!frm.doc.name) return
    frappe.call({
        method:"advance.overrides.employee_advance.employee_advance.change_status",
        args:{name:frm.doc.name},
        freeze: true,
        freeze_message: __("Update advance Please waite..."),
        callback:function(resp){
            if(resp.message.status === 201){
                frappe.show_alert({
                message: __("Advance Updated successfuly"),
                indicator: "green"
            }, 5);
            frm.reload_doc();
            }else{
                frappe.throw('An error has occurred. Please contact your administrator to resolve this issue.')
            }
        }
    })
}


async function get_employee_number(frm){
    let employee = null;
    const  response = await frappe.call({
        method:"advance.new_employee_advnce.doctype.food_expenses.food_expenses.get_employee_number",
        args:{user:frappe.session.user}
    })
   if(response.message.status === 404){
        if(frappe.user.has_role("System Manager")){
            frm.set_df_property('employee', 'read_only', true);
        }else{
            frm.set_df_property('employee', 'read_only', true);
            frappe.throw(response.message.message);
        }
   }else{
        response.message.data.forEach(item => employee = item.name)
        employee_number = employee;
   }
}
