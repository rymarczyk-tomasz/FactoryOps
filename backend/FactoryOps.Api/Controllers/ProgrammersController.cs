using FactoryOps.Api.Database.Models;
using FactoryOps.Api.Database.Repositories;
using Microsoft.AspNetCore.Mvc;

namespace FactoryOps.Api.Controllers;

[ApiController]
[Route("programmers")]
public class ProgrammesController(IRepository<Programmer> programmersRepository) : ControllerBase
{
	[HttpGet]
	[Route("{id}")]
	public async Task<ActionResult<Programmer>> GetProgrammer(int id) => Ok(await programmersRepository.Get(id));

	
	[HttpPost]
	[Route("create")]
	public async Task<IActionResult> CreateWorkItem([FromBody] Programmer programmer)
	{
		await programmersRepository.Insert(programmer);
		return Ok();
	}

	[HttpPatch]
	[Route("{id}/update")]
	public async Task<IActionResult> UpdateWorkItemById([FromBody] Programmer programmer)
	{
		await programmersRepository.Update(programmer);
		return Ok();
	}

	[HttpDelete]
	[Route("{id}/delete")]
	public async Task<IActionResult> DeleteWorkItemById([FromBody] Programmer programmer)
	{
		await programmersRepository.Delete(programmer);
		return Ok();
	}

}