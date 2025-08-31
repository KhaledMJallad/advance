let liaison_officer = null;

frappe.ui.form.on('Project', {
	onload:async function(frm) {
	    $(frm.$wrapper).find('.form-links').find('.section-body').find('[data-doctype="Expense Claim"]').find('.badge-link').html('Petty-cash')
	if(!frm.doc.custom_liaison_officer){
        $(frm.$wrapper).find('.form-links').find('.section-body').find('[data-doctype="Food Expenses"]').find('button').hide()
	    $(frm.$wrapper).find('.form-links').find('.section-body').find('[data-doctype="Expense Claim"]').find('button').hide()
	}else{
	    if(frappe.user.has_role("System Manager")){
            $(frm.$wrapper).find('.form-links').find('.section-body').find('[data-doctype="Food Expenses"]').find('button').show()
	    $(frm.$wrapper).find('.form-links').find('.section-body').find('[data-doctype="Expense Claim"]').find('button').show()
	    }else{
    	    await get_employee_number(frm);
    	    if(frm.doc.custom_liaison_officer === liaison_officer){
                $(frm.$wrapper).find('.form-links').find('.section-body').find('[data-doctype="Food Expenses"]').find('button').show()
	    $(frm.$wrapper).find('.form-links').find('.section-body').find('[data-doctype="Expense Claim"]').find('button').show()
    	    }else{
                $(frm.$wrapper).find('.form-links').find('.section-body').find('[data-doctype="Food Expenses"]').find('button').hide()
	    $(frm.$wrapper).find('.form-links').find('.section-body').find('[data-doctype="Expense Claim"]').find('button').hide()
    	    }
	        
	    }
	}

// 	    let petty_cash_status = await get_no_of_petty_cahs_request(frm)
// 		if(frappe.user.has_role('Projects Manager') || frappe.user.has_role('System Manager')){
// 		    frm.set_df_property('custom_liaison_officer', 'read_only', petty_cash_status) 
// 		    frm.set_df_property('custom_pettycash_amount', 'read_only', petty_cash_status) 
// 		}else{
// 		    frm.set_df_property('custom_liaison_officer', 'read_only', true) 
// 		    frm.set_df_property('custom_liaison_officer', 'read_only', true) 
// 		}
	}
})


async function get_employee_number(frm){
    const user = frappe.session.user;
    
    const response = await frappe.call({
        method:"advance.overrides.Project.Project.get_employee_id",
        args:{user:user}
    })
    if (response.message.status === 200){
        response.message.data.map(item => liaison_officer = item.name)
    }else{
        frappe.throw('User you logged in with is not exiets or not active. please contact your admin to solve the problem')
    }

}
