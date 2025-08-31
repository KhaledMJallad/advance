// let projects = [];
// let petty_cash_amount = 0
// let lission_officer = null;
// frappe.ui.form.on('Employee Advance', {
//     onload:async function(frm){
//         if(!frm.doc.custom_project) return;
//         await get_project_data_main(frm)
//         await get_employee_data(frm)
//     },
// })



// async function get_employee_data(frm){
//     let employee_number = null;
//     const response = await frappe.call({
//         method:"advance.overrides.employee_advance.employee_advance.get_employee_number",
//         args:{user:frappe.session.user}
//     })

//     if (response.message.status === 200){
//         response.message.data.map((item) => {
//             employee_number = item.name
//         });
//         if(lission_officer === employee_number){
//             frm.set_df_property('employee', 'read_only', true)
//             frm.set_value('employee', employee_number)
//             frm.set_value('purpose', 'Project Petty-cash Request')
//             await get_project_data(frm)
//         }else{
//             frm.set_value('custom_project', null)
//             frm.set_df_property('employee', 'read_only', false)
//         }
//         }else{
//             if(frappe.user.has_role("System Manager")){
//                 frm.set_df_property('employee', 'read_only', true)
//                 frm.set_value('employee', lission_officer)
//                 frm.set_value('purpose', 'Project Petty-cash Request')
//                 await get_project_data(frm)
//             }else{
//                 frm.set_value('custom_project', null)
//                 frm.set_df_property('employee', 'read_only', false)
//             }
            
//     }
// }

// async function get_project_data_main(frm){
//     const response = await frappe.call({
//         method:"advance.overrides.employee_advance.employee_advance.get_project_data_main",
//         args:{project:frm.doc.custom_project}
//     })

//     if (response.message.status === 200){
//         response.message.data.map((item) => {
//             lission_officer = item.custom_liaison_officer
//         })
//     }
// }

// async function get_project_data(frm){
//     const response = await frappe.call({
//         method:"advance.overrides.employee_advance.employee_advance.get_project_data",
//         args:{project:frm.doc.custom_project, employee:frm.doc.employee}
//     })
    
//     if(response.message.status === 200){
//     	petty_cash_amount = response.message.data
//     }else{
//         frappe.throw('The project has been selected has no data or there is somthing wring contatc with your admin to solve the problem')
//     }

//     frm.set_value('advance_amount', petty_cash_amount)
// }

